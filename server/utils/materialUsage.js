import { desc, eq, inArray } from 'drizzle-orm'
import { applyMaterialStockDelta } from './materialStock.js'
import { localDateStr } from './dates.js'

function money(value) {
  return Math.max(Math.round(Number(value) || 0), 0)
}

export async function loadMaterialUsagesByProduct(db, schema, productIds) {
  const ids = [...new Set((productIds || []).filter(Boolean))]
  const map = new Map(ids.map((id) => [id, []]))
  if (!ids.length) return map
  const rows = await db
    .select({
      id: schema.materialUsages.id,
      date: schema.materialUsages.date,
      materialId: schema.materialUsages.materialId,
      productId: schema.materialUsages.productId,
      quantity: schema.materialUsages.quantity,
      unitPrice: schema.materialUsages.unitPrice,
      amount: schema.materialUsages.amount,
      notes: schema.materialUsages.notes,
      materialName: schema.materials.name,
      unit: schema.materials.unit
    })
    .from(schema.materialUsages)
    .leftJoin(schema.materials, eq(schema.materialUsages.materialId, schema.materials.id))
    .where(inArray(schema.materialUsages.productId, ids))
    .orderBy(desc(schema.materialUsages.date), desc(schema.materialUsages.id))
  for (const row of rows) map.get(row.productId)?.push(row)
  return map
}

export function materialUsageTotal(rows) {
  return (rows || []).reduce((sum, row) => sum + money(row.amount), 0)
}

export async function recordMaterialUsage(db, schema, { materialId, productId, quantity, date, notes }) {
  const qty = Math.round(Number(quantity) || 0)
  if (!Number.isInteger(materialId) || materialId <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'Pilih perlengkapan' })
  }
  if (!Number.isInteger(productId) || productId <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'Pilih proyek' })
  }
  if (qty <= 0) throw createError({ statusCode: 400, statusMessage: 'Qty pemakaian wajib diisi' })

  return db.transaction(async (tx) => {
    const [material] = await tx.select().from(schema.materials).where(eq(schema.materials.id, materialId))
    if (!material) throw createError({ statusCode: 404, statusMessage: 'Perlengkapan tidak ditemukan' })
    const [product] = await tx.select({ id: schema.products.id, name: schema.products.name }).from(schema.products).where(eq(schema.products.id, productId))
    if (!product) throw createError({ statusCode: 404, statusMessage: 'Proyek tidak ditemukan' })
    if ((Number(material.stockQuantity) || 0) < qty) {
      throw createError({ statusCode: 400, statusMessage: `Stok ${material.name} tidak cukup` })
    }
    const unitPrice = money(material.pricePerUnit)
    const [usage] = await tx
      .insert(schema.materialUsages)
      .values({
        date: date || localDateStr(),
        materialId,
        productId,
        quantity: qty,
        unitPrice,
        amount: qty * unitPrice,
        notes: String(notes || '').trim() || null
      })
      .returning()
    await applyMaterialStockDelta(tx, schema, { id: materialId, delta: -qty })
    return { usage, materialName: material.name, unit: material.unit, productName: product.name }
  })
}

export async function deleteMaterialUsage(db, schema, id) {
  return db.transaction(async (tx) => {
    const [usage] = await tx.select().from(schema.materialUsages).where(eq(schema.materialUsages.id, id))
    if (!usage) throw createError({ statusCode: 404, statusMessage: 'Pemakaian tidak ditemukan' })
    await applyMaterialStockDelta(tx, schema, { id: usage.materialId, delta: usage.quantity })
    await tx.delete(schema.materialUsages).where(eq(schema.materialUsages.id, id))
    return usage
  })
}

export async function restoreMaterialUsageStock(tx, schema, productId) {
  const rows = await tx.select().from(schema.materialUsages).where(eq(schema.materialUsages.productId, productId))
  for (const row of rows) {
    await applyMaterialStockDelta(tx, schema, { id: row.materialId, delta: row.quantity })
  }
}
