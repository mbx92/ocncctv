import { asc, eq, inArray } from 'drizzle-orm'
import { parseRabLines, presentRabLine } from './customOrders.js'

export async function loadProjectExtraLines(db, schema, productIds) {
  const ids = [...new Set((productIds || []).filter(Boolean))]
  const map = new Map(ids.map((id) => [id, []]))
  if (!ids.length) return map
  const rows = await db
    .select({
      line: schema.projectExtraLines,
      catalogName: schema.supplierCatalogItems.name,
      catalogSheetLabel: schema.supplierCatalogItems.sheetLabel,
      catalogUnit: schema.supplierCatalogItems.unit,
      packagingName: schema.packaging.name,
      packagingUnit: schema.packaging.unit,
      packagingStock: schema.packaging.stockQuantity
    })
    .from(schema.projectExtraLines)
    .leftJoin(
      schema.supplierCatalogItems,
      eq(schema.projectExtraLines.catalogItemId, schema.supplierCatalogItems.id)
    )
    .leftJoin(schema.packaging, eq(schema.projectExtraLines.packagingId, schema.packaging.id))
    .where(inArray(schema.projectExtraLines.productId, ids))
    .orderBy(asc(schema.projectExtraLines.sortOrder), asc(schema.projectExtraLines.id))
  for (const row of rows) {
    const list = map.get(row.line.productId) || []
    list.push({
      ...presentRabLine(row.line, {
        catalogName: row.catalogName,
        catalogSheetLabel: row.catalogSheetLabel,
        catalogUnit: row.catalogUnit,
        packagingName: row.packagingName,
        packagingUnit: row.packagingUnit,
        packagingStock: row.packagingStock
      }),
      source: 'extra'
    })
    map.set(row.line.productId, list)
  }
  return map
}

export async function replaceProjectExtraLines(tx, schema, productId, rawLines) {
  const lines = parseRabLines(rawLines)
  await tx.delete(schema.projectExtraLines).where(eq(schema.projectExtraLines.productId, productId))
  if (!lines.length) return []
  await tx.insert(schema.projectExtraLines).values(
    lines.map((line, i) => ({
      productId,
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
  return lines
}

export async function loadProjectRabAdjustments(db, schema, productIds) {
  const ids = [...new Set((productIds || []).filter(Boolean))]
  const map = new Map(ids.map((id) => [id, []]))
  if (!ids.length) return map
  const rows = await db
    .select()
    .from(schema.projectRabAdjustments)
    .where(inArray(schema.projectRabAdjustments.productId, ids))
  for (const row of rows) {
    const list = map.get(row.productId) || []
    list.push({ customOrderLineId: row.customOrderLineId, quantity: row.quantity })
    map.set(row.productId, list)
  }
  return map
}

export function applyRabAdjustments(lines, adjustments) {
  const map = new Map(
    (adjustments || []).map((row) => [Number(row.customOrderLineId), Number(row.quantity)])
  )
  return (lines || []).map((line) => {
    const originalQuantity = Number(line.originalQuantity ?? line.quantity) || 0
    const id = Number(line.id)
    const quantity = map.has(id)
      ? Math.min(Math.max(Math.round(map.get(id) || 0), 0), originalQuantity)
      : originalQuantity
    return {
      ...line,
      originalQuantity,
      quantity,
      reduced: quantity < originalQuantity,
      omitted: quantity <= 0
    }
  })
}

export function parseRabAdjustments(raw, rabLines) {
  const byId = new Map((rabLines || []).map((line) => [Number(line.id), line]))
  const out = []
  for (const row of Array.isArray(raw) ? raw : []) {
    const lineId = Number(row.customOrderLineId || row.id)
    const orig = byId.get(lineId)
    if (!orig) continue
    const originalQuantity = Number(orig.originalQuantity ?? orig.quantity) || 0
    const quantity = Math.max(Math.round(Number(row.quantity) || 0), 0)
    if (quantity > originalQuantity) {
      throw createError({
        statusCode: 400,
        statusMessage: `Qty "${orig.name}" tidak boleh lebih dari qty RAB (${originalQuantity}). Tambah lewat tambahan.`
      })
    }
    if (quantity === originalQuantity) continue
    out.push({ customOrderLineId: lineId, quantity })
  }
  return out
}

export async function replaceProjectRabAdjustments(tx, schema, productId, adjustments) {
  await tx.delete(schema.projectRabAdjustments).where(eq(schema.projectRabAdjustments.productId, productId))
  if (!adjustments.length) return
  await tx.insert(schema.projectRabAdjustments).values(
    adjustments.map((row) => ({
      productId,
      customOrderLineId: row.customOrderLineId,
      quantity: row.quantity
    }))
  )
}
