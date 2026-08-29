import { eq, inArray } from 'drizzle-orm'
import { getSupplierCatalogSettings } from './supplierCatalogConfig.js'
import { loadProjectFinanceMap } from './projectRevenue.js'
import { createSupplierPurchase } from './supplierPurchase.js'

function catalogLines(lines) {
  return (lines || []).filter((line) => line.lineType !== 'service')
}

function normalizeKey(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
}

function purchasableScopeLines(finance) {
  const rabLines = (finance?.rab?.lines || []).map((line) => ({ ...line, source: 'rab' }))
  const extraLines = (finance?.extraLines || []).map((line) => ({ ...line, source: 'extra' }))
  return catalogLines([...rabLines, ...extraLines]).filter(
    (line) =>
      line.lineType !== 'product' &&
      (Number(line.quantity) || 0) > 0 &&
      !line.omitted
  )
}

function defaultSupplierName() {
  return getSupplierCatalogSettings(useRuntimeConfig().supplierCatalog || {}).supplierName
}

export function findPackagingForLine(packagingList, line) {
  if (line.lineType === 'product' && line.packagingId) {
    return packagingList.find((row) => row.id === Number(line.packagingId)) || null
  }
  const name = normalizeKey(line.name)
  const code = normalizeKey(line.code)
  if (name) {
    const exact = packagingList.find((row) => normalizeKey(row.name) === name)
    if (exact) return exact
  }
  if (code) {
    const byCode = packagingList.find((row) => normalizeKey(row.name).includes(code))
    if (byCode) return byCode
  }
  return null
}

function packagingValuesFromLine(line, catalogRow, supplierName) {
  return {
    name: String(line.name || catalogRow?.name || 'Produk').trim() || 'Produk',
    unit: String(line.unit || catalogRow?.unit || 'pcs').trim() || 'pcs',
    pricePerUnit: Math.max(Math.round(Number(line.costPrice ?? catalogRow?.supplierPrice) || 0), 0),
    stockQuantity: 0,
    supplier: catalogRow?.supplierName || supplierName || null
  }
}

async function loadCatalogMap(db, schema, catalogItemIds) {
  const ids = [...new Set((catalogItemIds || []).filter(Boolean))]
  const map = new Map()
  if (!ids.length) return map
  const rows = await db
    .select()
    .from(schema.supplierCatalogItems)
    .where(inArray(schema.supplierCatalogItems.id, ids))
  for (const row of rows) map.set(row.id, row)
  return map
}

function groupKeyForLine(line, packaging) {
  if (packaging?.id) return `p:${packaging.id}`
  return `new:${normalizeKey(line.name)}:${normalizeKey(line.code)}`
}

function planRabPurchase(scopeLines, packagingList, catalogMap, supplierName) {
  const groups = new Map()

  for (const line of scopeLines) {
    const requiredQty = Math.max(Math.round(Number(line.quantity) || 0), 0)
    if (requiredQty <= 0) continue

    const catalogRow = line.catalogItemId ? catalogMap.get(line.catalogItemId) : null
    const packaging = findPackagingForLine(packagingList, line)
    const key = groupKeyForLine(line, packaging)

    if (!groups.has(key)) {
      groups.set(key, {
        packaging,
        requiredQty: 0,
        sourceLineIds: [],
        name: line.name,
        code: line.code || '',
        unit: line.unit || '',
        source: line.source || 'rab',
        lineType: line.lineType,
        catalogItemId: line.catalogItemId || null,
        catalogRow,
        unitPrice: Math.max(Math.round(Number(line.costPrice ?? catalogRow?.supplierPrice) || 0), 0)
      })
    }

    const group = groups.get(key)
    group.requiredQty += requiredQty
    if (line.id) group.sourceLineIds.push(line.id)
  }

  const lines = []
  const skippedLines = []

  for (const group of groups.values()) {
    const stockAvailable = group.packaging
      ? Math.max(Math.round(Number(group.packaging.stockQuantity) || 0), 0)
      : 0
    const purchaseQty = Math.max(group.requiredQty - stockAvailable, 0)

    if (purchaseQty <= 0) {
      skippedLines.push({
        name: group.name,
        code: group.code,
        unit: group.unit,
        source: group.source,
        requiredQuantity: group.requiredQty,
        stockAvailable,
        reason: 'stock_covered'
      })
      continue
    }

    lines.push({
      sourceLineIds: group.sourceLineIds,
      source: group.source,
      lineType: group.lineType,
      catalogItemId: group.catalogItemId,
      packagingId: group.packaging?.id || null,
      name: group.name,
      code: group.code,
      unit: group.unit,
      requiredQuantity: group.requiredQty,
      stockAvailable,
      quantity: purchaseQty,
      unitPrice: group.unitPrice,
      matchStatus: group.packaging ? 'matched' : 'missing',
      suggestedPackaging: group.packaging
        ? null
        : packagingValuesFromLine(
            {
              name: group.name,
              unit: group.unit,
              costPrice: group.unitPrice,
              catalogItemId: group.catalogItemId
            },
            group.catalogRow,
            supplierName
          )
    })
  }

  return { lines, skippedLines }
}

function emptyPurchaseMessage(scopeLines, skippedLines) {
  if (!scopeLines.length) {
    return 'Tidak ada barang katalog yang perlu dibeli untuk proyek ini'
  }
  if (skippedLines.length) {
    return 'Semua barang sudah tersedia di gudang — tidak perlu pembelian'
  }
  return 'Tidak ada barang yang perlu dibeli untuk proyek ini'
}

export async function buildRabPurchaseDraft(db, schema, productId) {
  const [project] = await db
    .select({ id: schema.products.id, name: schema.products.name })
    .from(schema.products)
    .where(eq(schema.products.id, productId))
  if (!project) throw createError({ statusCode: 404, statusMessage: 'Proyek tidak ditemukan' })

  const financeMap = await loadProjectFinanceMap(db, schema, [productId])
  const finance = financeMap.get(productId)
  const scopeLines = purchasableScopeLines(finance)
  const packagingList = await db.select().from(schema.packaging)
  const catalogMap = await loadCatalogMap(
    db,
    schema,
    scopeLines.filter((line) => line.lineType === 'catalog').map((line) => line.catalogItemId)
  )
  const supplierName = defaultSupplierName()
  const { lines, skippedLines } = planRabPurchase(scopeLines, packagingList, catalogMap, supplierName)

  if (!lines.length) {
    throw createError({ statusCode: 400, statusMessage: emptyPurchaseMessage(scopeLines, skippedLines) })
  }

  return {
    projectId: project.id,
    projectName: project.name,
    suggestedSupplier: supplierName,
    lines,
    skippedLines
  }
}

export async function resolveRabPurchaseLines(tx, schema, productId, { createMissing = true } = {}) {
  const financeMap = await loadProjectFinanceMap(tx, schema, [productId])
  const finance = financeMap.get(productId)
  const scopeLines = purchasableScopeLines(finance)
  let packagingList = await tx.select().from(schema.packaging)
  const catalogMap = await loadCatalogMap(
    tx,
    schema,
    scopeLines.filter((line) => line.lineType === 'catalog').map((line) => line.catalogItemId)
  )
  const supplierName = defaultSupplierName()
  let { lines, skippedLines } = planRabPurchase(scopeLines, packagingList, catalogMap, supplierName)

  if (!lines.length) {
    throw createError({ statusCode: 400, statusMessage: emptyPurchaseMessage(scopeLines, skippedLines) })
  }

  const resolved = []

  for (const line of lines) {
    if (line.packagingId) {
      resolved.push({
        itemType: 'packaging',
        packagingId: line.packagingId,
        quantity: line.quantity,
        stockQuantity: 0,
        unitPrice: line.unitPrice,
        name: line.name
      })
      continue
    }

    if (!createMissing) {
      throw createError({
        statusCode: 400,
        statusMessage: `Produk "${line.name}" belum ada di gudang. Buat produk dulu atau aktifkan pembuatan otomatis.`
      })
    }

    const values = line.suggestedPackaging || packagingValuesFromLine(line, null, supplierName)
    const [created] = await tx.insert(schema.packaging).values(values).returning()
    packagingList = [...packagingList, created]
    resolved.push({
      itemType: 'packaging',
      packagingId: created.id,
      quantity: line.quantity,
      stockQuantity: 0,
      unitPrice: line.unitPrice,
      name: created.name
    })
  }

  return resolved
}

export async function createPurchaseFromRab(db, schema, productId, body) {
  return db.transaction(async (tx) => {
    const purchaseLines = await resolveRabPurchaseLines(tx, schema, productId, {
      createMissing: body.createMissingPackaging !== false
    })
    return createSupplierPurchase(tx, schema, {
      ...body,
      projectId: productId,
      category: body.category || 'packaging',
      lines: purchaseLines.map((line) => ({
        itemType: 'packaging',
        packagingId: line.packagingId,
        quantity: line.quantity,
        stockQuantity: 0,
        unitPrice: line.unitPrice
      }))
    })
  })
}
