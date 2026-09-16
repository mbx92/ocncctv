import { eq, inArray } from 'drizzle-orm'
import { getSupplierCatalogSettings } from './supplierCatalogConfig.js'
import { loadProjectFinanceMap } from './projectRevenue.js'
import { createSupplierPurchase } from './supplierPurchase.js'
import {
  cableRollInfo,
  formatRollHint,
  packagingRollInfo,
  requiredMeters,
  rollsForMeters,
  stockAsMeters
} from './cableRoll.js'

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

async function loadProjectPurchasedQty(db, schema, productId) {
  const rows = await db
    .select({
      packagingId: schema.supplierPurchaseLines.packagingId,
      quantity: schema.supplierPurchaseLines.quantity,
      stockQuantity: schema.supplierPurchaseLines.stockQuantity,
      itemType: schema.supplierPurchaseLines.itemType
    })
    .from(schema.supplierPurchaseLines)
    .innerJoin(
      schema.supplierPurchases,
      eq(schema.supplierPurchaseLines.purchaseId, schema.supplierPurchases.id)
    )
    .where(eq(schema.supplierPurchases.projectId, productId))

  const map = new Map()
  for (const row of rows) {
    if (row.itemType !== 'packaging' || !row.packagingId) continue
    const id = Number(row.packagingId)
    const prev = map.get(id) || { quantity: 0, stocked: 0 }
    prev.quantity += Math.max(Math.round(Number(row.quantity) || 0), 0)
    prev.stocked += Math.max(Math.round(Number(row.stockQuantity) || 0), 0)
    map.set(id, prev)
  }
  return map
}

async function loadRabPurchaseContext(db, schema, productId) {
  const financeMap = await loadProjectFinanceMap(db, schema, [productId])
  const finance = financeMap.get(productId)
  const scopeLines = purchasableScopeLines(finance)
  const packagingList = await db.select().from(schema.packaging)
  const catalogMap = await loadCatalogMap(
    db,
    schema,
    scopeLines.filter((line) => line.lineType === 'catalog').map((line) => line.catalogItemId)
  )
  const purchasedByPackaging = await loadProjectPurchasedQty(db, schema, productId)
  const supplierName = defaultSupplierName()
  return { scopeLines, packagingList, catalogMap, purchasedByPackaging, supplierName }
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
  const roll = cableRollInfo({
    name: line.name || catalogRow?.name,
    code: line.code || catalogRow?.code,
    unit: catalogRow?.unit || line.unit,
    supplierPrice: catalogRow?.supplierPrice,
    costPrice: line.costPrice,
    pricePerUnit: catalogRow?.supplierPrice,
    contentQty: catalogRow?.contentQty || catalogRow?.metersPerRoll
  })
  if (roll) {
    return {
      name: String(line.name || catalogRow?.name || 'Produk').trim() || 'Produk',
      unit: 'meter',
      purchaseUnit: 'roll',
      unitsPerPurchase: roll.metersPerRoll,
      pricePerUnit: roll.pricePerMeter,
      stockQuantity: 0,
      supplier: catalogRow?.supplierName || supplierName || null
    }
  }
  return {
    name: String(line.name || catalogRow?.name || 'Produk').trim() || 'Produk',
    unit: String(line.unit || catalogRow?.unit || 'pcs').trim() || 'pcs',
    purchaseUnit: null,
    unitsPerPurchase: 1,
    pricePerUnit: Math.max(Math.round(Number(line.costPrice ?? catalogRow?.supplierPrice) || 0), 0),
    stockQuantity: 0,
    supplier: catalogRow?.supplierName || supplierName || null
  }
}

function allocatedPurchaseUnits(entry) {
  if (!entry) return 0
  return Math.max((Number(entry.quantity) || 0) - (Number(entry.stocked) || 0), 0)
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

function planRabPurchase(scopeLines, packagingList, catalogMap, supplierName, purchasedByPackaging = new Map()) {
  const groups = new Map()

  for (const line of scopeLines) {
    const requiredQty = Math.max(Math.round(Number(line.quantity) || 0), 0)
    if (requiredQty <= 0) continue

    const catalogRow = line.catalogItemId ? catalogMap.get(line.catalogItemId) : null
    const packaging = findPackagingForLine(packagingList, line)
    const key = groupKeyForLine(line, packaging)

    if (!groups.has(key)) {
      groups.set(key, {
        key,
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
    const roll = packagingRollInfo(group.packaging, group.catalogRow) || cableRollInfo({
      name: group.name,
      code: group.code,
      unit: group.catalogRow?.unit || group.unit,
      supplierPrice: group.catalogRow?.supplierPrice,
      costPrice: group.unitPrice,
      contentQty: group.catalogRow?.contentQty || group.catalogRow?.metersPerRoll
    })
    const needMeters = roll ? requiredMeters(group.requiredQty, group.unit, roll) : group.requiredQty
    const stockAvailable = stockAsMeters(group.packaging, roll)
    const allocatedUnits = group.packaging?.id
      ? allocatedPurchaseUnits(purchasedByPackaging.get(Number(group.packaging.id)))
      : 0
    const alreadyPurchased = roll ? allocatedUnits * roll.metersPerRoll : allocatedUnits
    const coveredQty = stockAvailable + alreadyPurchased
    const uncovered = Math.max(needMeters - coveredQty, 0)
    const purchaseQty = roll ? rollsForMeters(uncovered, roll.metersPerRoll) : uncovered
    const unitPrice = roll ? roll.rollPrice : group.unitPrice
    const purchaseUnit = roll ? roll.purchaseUnit : group.unit

    if (purchaseQty <= 0) {
      skippedLines.push({
        name: group.name,
        code: group.code,
        unit: roll ? roll.stockUnit : group.unit,
        source: group.source,
        requiredQuantity: needMeters,
        stockAvailable,
        alreadyPurchased,
        metersPerRoll: roll?.metersPerRoll || null,
        reason: alreadyPurchased > 0 ? 'already_purchased' : 'stock_covered'
      })
      continue
    }

    lines.push({
      key: group.key,
      sourceLineIds: group.sourceLineIds,
      source: group.source,
      lineType: group.lineType,
      catalogItemId: group.catalogItemId,
      packagingId: group.packaging?.id || null,
      name: group.name,
      code: group.code,
      unit: purchaseUnit,
      requiredQuantity: needMeters,
      requiredUnit: roll ? roll.stockUnit : group.unit,
      stockAvailable,
      alreadyPurchased,
      quantity: purchaseQty,
      unitPrice,
      metersPerRoll: roll?.metersPerRoll || null,
      purchaseUnit: roll?.purchaseUnit || null,
      stockUnit: roll?.stockUnit || group.unit,
      conversionHint: roll ? formatRollHint(roll.metersPerRoll) : '',
      matchStatus: group.packaging ? 'matched' : 'missing',
      suggestedPackaging: group.packaging
        ? null
        : packagingValuesFromLine(
            {
              name: group.name,
              code: group.code,
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
    return 'Semua barang proyek ini sudah dibeli atau tersedia di gudang'
  }
  return 'Tidak ada barang yang perlu dibeli untuk proyek ini'
}

export async function evaluateRabPurchaseNeed(db, schema, productId) {
  const [project] = await db
    .select({ id: schema.products.id })
    .from(schema.products)
    .where(eq(schema.products.id, productId))
  if (!project) return { canPurchase: false, lineCount: 0, skippedCount: 0 }

  const ctx = await loadRabPurchaseContext(db, schema, productId)
  const { lines, skippedLines } = planRabPurchase(
    ctx.scopeLines,
    ctx.packagingList,
    ctx.catalogMap,
    ctx.supplierName,
    ctx.purchasedByPackaging
  )
  return {
    canPurchase: lines.length > 0,
    lineCount: lines.length,
    skippedCount: skippedLines.length,
    scopeCount: ctx.scopeLines.length
  }
}

export async function buildRabPurchaseDraft(db, schema, productId) {
  const [project] = await db
    .select({ id: schema.products.id, name: schema.products.name })
    .from(schema.products)
    .where(eq(schema.products.id, productId))
  if (!project) throw createError({ statusCode: 404, statusMessage: 'Proyek tidak ditemukan' })

  const ctx = await loadRabPurchaseContext(db, schema, productId)
  const { lines, skippedLines } = planRabPurchase(
    ctx.scopeLines,
    ctx.packagingList,
    ctx.catalogMap,
    ctx.supplierName,
    ctx.purchasedByPackaging
  )

  if (!lines.length) {
    throw createError({
      statusCode: 400,
      statusMessage: emptyPurchaseMessage(ctx.scopeLines, skippedLines)
    })
  }

  return {
    projectId: project.id,
    projectName: project.name,
    suggestedSupplier: ctx.supplierName,
    lines,
    skippedLines
  }
}

export async function resolveRabPurchaseLines(tx, schema, productId, { createMissing = true, selectedKeys } = {}) {
  const ctx = await loadRabPurchaseContext(tx, schema, productId)
  let { lines, skippedLines } = planRabPurchase(
    ctx.scopeLines,
    ctx.packagingList,
    ctx.catalogMap,
    ctx.supplierName,
    ctx.purchasedByPackaging
  )

  if (Array.isArray(selectedKeys)) {
    const wanted = new Set(selectedKeys.map(String).filter(Boolean))
    if (!wanted.size) {
      throw createError({ statusCode: 400, statusMessage: 'Pilih minimal satu barang untuk dibeli' })
    }
    lines = lines.filter((line) => wanted.has(String(line.key)))
    if (!lines.length) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Barang yang dipilih tidak lagi perlu dibeli. Muat ulang daftar kebutuhan.'
      })
    }
  }

  if (!lines.length) {
    throw createError({
      statusCode: 400,
      statusMessage: emptyPurchaseMessage(ctx.scopeLines, skippedLines)
    })
  }

  let packagingList = ctx.packagingList
  const resolved = []

  for (const line of lines) {
    if (line.packagingId) {
      resolved.push({
        itemType: 'packaging',
        packagingId: line.packagingId,
        quantity: line.quantity,
        stockQuantity: line.metersPerRoll ? line.quantity : 0,
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

    const values = line.suggestedPackaging || packagingValuesFromLine(line, null, ctx.supplierName)
    const [created] = await tx.insert(schema.packaging).values(values).returning()
    packagingList = [...packagingList, created]
    resolved.push({
      itemType: 'packaging',
      packagingId: created.id,
      quantity: line.quantity,
      stockQuantity: (created.unitsPerPurchase > 1 || line.metersPerRoll) ? line.quantity : 0,
      unitPrice: line.unitPrice,
      name: created.name
    })
  }

  return resolved
}

export async function createPurchaseFromRab(db, schema, productId, body) {
  return db.transaction(async (tx) => {
    const purchaseLines = await resolveRabPurchaseLines(tx, schema, productId, {
      createMissing: body.createMissingPackaging !== false,
      selectedKeys: Array.isArray(body.selectedKeys) ? body.selectedKeys : undefined
    })
    return createSupplierPurchase(tx, schema, {
      ...body,
      projectId: productId,
      category: body.category || 'packaging',
      lines: purchaseLines.map((line) => ({
        itemType: 'packaging',
        packagingId: line.packagingId,
        quantity: line.quantity,
        stockQuantity: line.stockQuantity,
        unitPrice: line.unitPrice
      }))
    })
  })
}
