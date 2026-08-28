import { and, asc, eq, gt, inArray } from 'drizzle-orm'
import { useDb, schema } from '../db/index.js'
import { getSettings } from './settings.js'
import { parseRabLines, presentRabLine, totalsFromLines } from './customOrders.js'
import { suggestedSalePrice } from './salePrice.js'
import { catalogDisplayName } from './catalogName.js'
import { clampShareTtlDays, newShareToken } from './invoice.js'

export function packageNumberFor(id) {
  const n = Math.max(Math.round(Number(id) || 0), 0)
  return `PKT-${String(n).padStart(4, '0')}`
}

export function parsePackageBody(body, { allowEmptyLines = false } = {}) {
  const name = String(body?.name || '').trim()
  if (!name) throw createError({ statusCode: 400, statusMessage: 'Nama paket wajib diisi' })
  const hasLines = Array.isArray(body.lines)
  const lines = hasLines ? parseRabLines(body.lines) : null
  if (hasLines && !allowEmptyLines && !lines.length) {
    throw createError({ statusCode: 400, statusMessage: 'Minimal satu baris di paket' })
  }
  return {
    header: {
      name,
      description: body.description ? String(body.description).trim() || null : null,
      notes: body.notes ? String(body.notes).trim() || null : null
    },
    lines,
    totals: totalsFromLines(lines || [])
  }
}

export async function replacePackageLines(tx, packageId, lines) {
  await tx.delete(schema.packageLines).where(eq(schema.packageLines.packageId, packageId))
  if (!lines.length) return
  await tx.insert(schema.packageLines).values(
    lines.map((line, i) => ({
      packageId,
      lineType: line.lineType,
      catalogItemId: line.catalogItemId,
      serviceId: line.serviceId,
      packagingId: line.packagingId,
      name: line.name,
      code: line.code,
      unit: line.unit || null,
      quantity: line.quantity,
      costPrice: line.costPrice,
      salePrice: line.salePrice,
      sortOrder: i
    }))
  )
}

export async function loadPackageLines(db, packageIds) {
  const ids = [...new Set((packageIds || []).filter(Boolean))]
  const map = new Map(ids.map((id) => [id, []]))
  if (!ids.length) return map
  const rows = await db
    .select({
      line: schema.packageLines,
      catalogName: schema.supplierCatalogItems.name,
      catalogSheetLabel: schema.supplierCatalogItems.sheetLabel,
      catalogUnit: schema.supplierCatalogItems.unit,
      packagingName: schema.packaging.name,
      packagingUnit: schema.packaging.unit,
      packagingStock: schema.packaging.stockQuantity
    })
    .from(schema.packageLines)
    .leftJoin(
      schema.supplierCatalogItems,
      eq(schema.packageLines.catalogItemId, schema.supplierCatalogItems.id)
    )
    .leftJoin(schema.packaging, eq(schema.packageLines.packagingId, schema.packaging.id))
    .where(inArray(schema.packageLines.packageId, ids))
    .orderBy(asc(schema.packageLines.sortOrder), asc(schema.packageLines.id))
  for (const row of rows) {
    const list = map.get(row.line.packageId) || []
    list.push(
      presentRabLine(row.line, {
        catalogName: row.catalogName,
        catalogSheetLabel: row.catalogSheetLabel,
        catalogUnit: row.catalogUnit,
        packagingName: row.packagingName,
        packagingUnit: row.packagingUnit,
        packagingStock: row.packagingStock
      })
    )
    map.set(row.line.packageId, list)
  }
  return map
}

export function withPackageTotals(pkg, lines) {
  const totals = totalsFromLines(lines || [])
  return { ...pkg, lines: lines || [], ...totals }
}

export async function syncPackageLinePrices(db, lines, settings) {
  const margin = settings?.defaultMarginPercent ?? 40
  const rounding = settings?.salePriceRounding ?? 500
  const catalogIds = [
    ...new Set(lines.filter((l) => l.lineType === 'catalog' && l.catalogItemId).map((l) => l.catalogItemId))
  ]
  const packagingIds = [
    ...new Set(lines.filter((l) => l.lineType === 'product' && l.packagingId).map((l) => l.packagingId))
  ]
  const serviceIds = [
    ...new Set(lines.filter((l) => l.lineType === 'service' && l.serviceId).map((l) => l.serviceId))
  ]

  const [catalogRows, packagingRows, serviceRows] = await Promise.all([
    catalogIds.length
      ? db
          .select({
            id: schema.supplierCatalogItems.id,
            supplierPrice: schema.supplierCatalogItems.supplierPrice,
            name: schema.supplierCatalogItems.name,
            sheetLabel: schema.supplierCatalogItems.sheetLabel,
            code: schema.supplierCatalogItems.code,
            unit: schema.supplierCatalogItems.unit
          })
          .from(schema.supplierCatalogItems)
          .where(inArray(schema.supplierCatalogItems.id, catalogIds))
      : [],
    packagingIds.length
      ? db
          .select({
            id: schema.packaging.id,
            name: schema.packaging.name,
            unit: schema.packaging.unit,
            pricePerUnit: schema.packaging.pricePerUnit,
            stockQuantity: schema.packaging.stockQuantity
          })
          .from(schema.packaging)
          .where(inArray(schema.packaging.id, packagingIds))
      : [],
    serviceIds.length
      ? db
          .select({
            id: schema.services.id,
            name: schema.services.name,
            unit: schema.services.unit,
            salePrice: schema.services.salePrice
          })
          .from(schema.services)
          .where(inArray(schema.services.id, serviceIds))
      : []
  ])

  const catalogById = new Map(catalogRows.map((r) => [r.id, r]))
  const packagingById = new Map(packagingRows.map((r) => [r.id, r]))
  const serviceById = new Map(serviceRows.map((r) => [r.id, r]))

  return lines.map((line) => {
    if (line.lineType === 'catalog' && line.catalogItemId) {
      const item = catalogById.get(line.catalogItemId)
      if (!item) return line
      const cost = Math.max(Math.round(Number(item.supplierPrice) || 0), 0)
      return {
        ...line,
        name: catalogDisplayName(item) || line.name,
        code: item.code || line.code,
        unit: item.unit || line.unit || 'pcs',
        costPrice: cost,
        salePrice: suggestedSalePrice(cost, margin, rounding)
      }
    }
    if (line.lineType === 'product' && line.packagingId) {
      const item = packagingById.get(line.packagingId)
      if (!item) return line
      const cost = Math.max(Math.round(Number(item.pricePerUnit) || 0), 0)
      return {
        ...line,
        name: item.name || line.name,
        unit: item.unit || line.unit,
        costPrice: cost,
        salePrice: suggestedSalePrice(cost, margin, rounding),
        stockQuantity: item.stockQuantity
      }
    }
    if (line.lineType === 'service' && line.serviceId) {
      const item = serviceById.get(line.serviceId)
      if (!item) return line
      return {
        ...line,
        name: item.name || line.name,
        unit: item.unit || line.unit,
        costPrice: 0,
        salePrice: Math.max(Math.round(Number(item.salePrice) || 0), 0)
      }
    }
    return line
  })
}

export function toPackageQuotePayload(pkg, lines, settings) {
  const items = (lines || []).map((line) => {
    const qty = Math.max(Math.round(Number(line.quantity) || 0), 0)
    const unitPrice = Math.max(Math.round(Number(line.salePrice) || 0), 0)
    return {
      name: String(line.name || '').trim() || 'Item',
      code: '',
      lineType: line.lineType === 'service' ? 'service' : 'catalog',
      quantity: qty,
      unit: String(line.unit || '').trim(),
      unitPrice,
      amount: qty * unitPrice
    }
  })
  const total = items.reduce((sum, item) => sum + item.amount, 0)
  const created = pkg.createdAt instanceof Date ? pkg.createdAt : pkg.createdAt ? new Date(pkg.createdAt) : new Date()
  const date = Number.isNaN(created.getTime())
    ? null
    : `${created.getFullYear()}-${String(created.getMonth() + 1).padStart(2, '0')}-${String(created.getDate()).padStart(2, '0')}`
  return {
    docLabel: 'Paket',
    quoteNumber: packageNumberFor(pkg.id),
    date,
    customerName: '',
    title: pkg.name,
    notes: pkg.description || null,
    items,
    total,
    business: {
      name: settings.invoiceBusinessName || 'OCN',
      address: settings.invoiceAddress || null,
      phone: settings.invoicePhone || null,
      footer: settings.rabFooter || settings.invoiceFooter || 'Terima kasih atas kepercayaannya.'
    }
  }
}

export async function loadPackageQuotePayload(db, id) {
  const [pkg] = await db.select().from(schema.packages).where(eq(schema.packages.id, id))
  if (!pkg) return null
  const lineMap = await loadPackageLines(db, [id])
  const settings = await getSettings()
  return toPackageQuotePayload(pkg, lineMap.get(id) || [], settings)
}

export async function loadPublicPackage(token) {
  const raw = String(token || '').trim()
  if (!raw) throw createError({ statusCode: 404, statusMessage: 'Tautan tidak valid' })
  const db = useDb()
  const [link] = await db
    .select()
    .from(schema.packageShareLinks)
    .where(and(eq(schema.packageShareLinks.token, raw), gt(schema.packageShareLinks.expiresAt, new Date())))
  if (!link) throw createError({ statusCode: 404, statusMessage: 'Tautan tidak valid atau sudah kedaluwarsa' })
  const quote = await loadPackageQuotePayload(db, link.packageId)
  if (!quote) throw createError({ statusCode: 404, statusMessage: 'Paket tidak ditemukan' })
  return { quote, expiresAt: link.expiresAt }
}

export async function createPackageShareLink(db, packageId, { rotate = false } = {}) {
  const settings = await getSettings()
  const ttlDays = clampShareTtlDays(settings.invoiceShareTtlDays)
  return db.transaction(async (tx) => {
    const [row] = await tx.select({ id: schema.packages.id }).from(schema.packages).where(eq(schema.packages.id, packageId))
    if (!row) throw createError({ statusCode: 404, statusMessage: 'Paket tidak ditemukan' })
    if (!rotate) {
      const [existing] = await tx
        .select()
        .from(schema.packageShareLinks)
        .where(and(eq(schema.packageShareLinks.packageId, packageId), gt(schema.packageShareLinks.expiresAt, new Date())))
        .limit(1)
      if (existing) return { token: existing.token, expiresAt: existing.expiresAt, reused: true, ttlDays }
    } else {
      await tx.delete(schema.packageShareLinks).where(eq(schema.packageShareLinks.packageId, packageId))
    }
    const token = newShareToken()
    const expiresAt = new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000)
    const [created] = await tx
      .insert(schema.packageShareLinks)
      .values({ packageId, token, expiresAt })
      .returning()
    return { token: created.token, expiresAt: created.expiresAt, reused: false, ttlDays }
  })
}
