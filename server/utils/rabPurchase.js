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
    (line) => (Number(line.quantity) || 0) > 0 && !line.omitted
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

function mergePurchaseLine(map, packagingId, line, packagingName) {
  const quantity = Math.max(Math.round(Number(line.quantity) || 0), 0)
  const unitPrice = Math.max(Math.round(Number(line.costPrice) || 0), 0)
  const key = Number(packagingId)
  const existing = map.get(key)
  if (existing) {
    existing.quantity += quantity
    return
  }
  map.set(key, {
    itemType: 'packaging',
    packagingId: key,
    quantity,
    stockQuantity: 0,
    unitPrice,
    name: packagingName || line.name,
    sourceLineIds: [line.id].filter(Boolean)
  })
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
  if (!scopeLines.length) {
    throw createError({ statusCode: 400, statusMessage: 'Tidak ada barang yang perlu dibeli untuk proyek ini' })
  }

  const packagingList = await db.select().from(schema.packaging)
  const catalogMap = await loadCatalogMap(
    db,
    schema,
    scopeLines.filter((line) => line.lineType === 'catalog').map((line) => line.catalogItemId)
  )
  const supplierName = defaultSupplierName()

  const draftLines = scopeLines.map((line) => {
    const catalogRow = line.catalogItemId ? catalogMap.get(line.catalogItemId) : null
    const matched = findPackagingForLine(packagingList, line)
    const unitPrice = Math.max(Math.round(Number(line.costPrice ?? catalogRow?.supplierPrice) || 0), 0)
    return {
      sourceLineId: line.id || null,
      source: line.source || 'rab',
      lineType: line.lineType,
      catalogItemId: line.catalogItemId || null,
      packagingId: matched?.id || null,
      name: line.name,
      code: line.code || '',
      unit: line.unit || '',
      quantity: Math.max(Math.round(Number(line.quantity) || 0), 0),
      unitPrice,
      matchStatus: matched ? 'matched' : 'missing',
      suggestedPackaging: matched
        ? null
        : packagingValuesFromLine(line, catalogRow, supplierName)
    }
  })

  const merged = new Map()
  for (const row of draftLines) {
    const key = row.packagingId ? `p:${row.packagingId}` : `new:${normalizeKey(row.name)}:${normalizeKey(row.code)}`
    const existing = merged.get(key)
    if (existing) {
      existing.quantity += row.quantity
      if (row.sourceLineId) existing.sourceLineIds.push(row.sourceLineId)
      continue
    }
    merged.set(key, {
      ...row,
      sourceLineIds: row.sourceLineId ? [row.sourceLineId] : []
    })
  }

  return {
    projectId: project.id,
    projectName: project.name,
    suggestedSupplier: supplierName,
    lines: [...merged.values()]
  }
}

export async function resolveRabPurchaseLines(tx, schema, productId, { createMissing = true } = {}) {
  const financeMap = await loadProjectFinanceMap(tx, schema, [productId])
  const finance = financeMap.get(productId)
  const scopeLines = purchasableScopeLines(finance)
  if (!scopeLines.length) {
    throw createError({ statusCode: 400, statusMessage: 'Tidak ada barang yang perlu dibeli untuk proyek ini' })
  }

  const packagingList = await tx.select().from(schema.packaging)
  const catalogMap = await loadCatalogMap(
    tx,
    schema,
    scopeLines.filter((line) => line.lineType === 'catalog').map((line) => line.catalogItemId)
  )
  const supplierName = defaultSupplierName()
  const merged = new Map()

  for (const line of scopeLines) {
    const catalogRow = line.catalogItemId ? catalogMap.get(line.catalogItemId) : null
    let packaging = findPackagingForLine(packagingList, line)

    if (!packaging) {
      if (!createMissing) {
        throw createError({
          statusCode: 400,
          statusMessage: `Produk "${line.name}" belum ada di gudang. Buat produk dulu atau aktifkan pembuatan otomatis.`
        })
      }
      const values = packagingValuesFromLine(line, catalogRow, supplierName)
      const [created] = await tx.insert(schema.packaging).values(values).returning()
      packaging = created
      packagingList.push(created)
    }

    mergePurchaseLine(merged, packaging.id, line, packaging.name)
  }

  return [...merged.values()]
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
