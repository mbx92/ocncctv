import { and, desc, eq, inArray, sql } from 'drizzle-orm'
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

async function insertMaterialUsage(tx, schema, { materialId, productId, quantity, date, notes }) {
  const qty = Math.round(Number(quantity) || 0)
  if (!Number.isInteger(materialId) || materialId <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'Pilih perlengkapan' })
  }
  if (!Number.isInteger(productId) || productId <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'Pilih proyek' })
  }
  if (qty <= 0) throw createError({ statusCode: 400, statusMessage: 'Qty pemakaian wajib diisi' })

  const [material] = await tx.select().from(schema.materials).where(eq(schema.materials.id, materialId))
  if (!material) throw createError({ statusCode: 404, statusMessage: 'Perlengkapan tidak ditemukan' })
  const [product] = await tx
    .select({ id: schema.products.id, name: schema.products.name })
    .from(schema.products)
    .where(eq(schema.products.id, productId))
  if (!product) throw createError({ statusCode: 404, statusMessage: 'Proyek tidak ditemukan' })
  if ((Number(material.stockQuantity) || 0) < qty) {
    throw createError({
      statusCode: 400,
      statusMessage: `Stok ${material.name} tidak cukup. Sisa ${material.stockQuantity} ${material.unit}.`
    })
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
}

async function reduceMaterialUsages(tx, schema, rows, reduceBy) {
  let left = Math.max(Math.round(Number(reduceBy) || 0), 0)
  const ordered = [...rows].sort((a, b) => String(b.date).localeCompare(String(a.date)) || b.id - a.id)
  for (const row of ordered) {
    if (left <= 0) break
    const qty = Math.max(Math.round(Number(row.quantity) || 0), 0)
    if (qty <= left) {
      await applyMaterialStockDelta(tx, schema, { id: row.materialId, delta: qty })
      await tx.delete(schema.materialUsages).where(eq(schema.materialUsages.id, row.id))
      left -= qty
      continue
    }
    const nextQty = qty - left
    const unitPrice = money(row.unitPrice)
    await applyMaterialStockDelta(tx, schema, { id: row.materialId, delta: left })
    await tx
      .update(schema.materialUsages)
      .set({ quantity: nextQty, amount: nextQty * unitPrice })
      .where(eq(schema.materialUsages.id, row.id))
    left = 0
  }
}

export async function recordMaterialUsage(db, schema, payload) {
  return db.transaction((tx) => insertMaterialUsage(tx, schema, payload))
}

async function applyUsagePrices(tx, schema, { productId, materialId, unitPrice }) {
  const price = money(unitPrice)
  await tx
    .update(schema.materialUsages)
    .set({
      unitPrice: price,
      amount: sql`${schema.materialUsages.quantity} * ${price}`
    })
    .where(
      and(eq(schema.materialUsages.productId, productId), eq(schema.materialUsages.materialId, materialId))
    )
}

export async function syncProjectMaterialChecklist(db, schema, productId, items) {
  if (!Number.isInteger(productId) || productId <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'Proyek tidak valid' })
  }
  const wanted = new Map()
  const prices = new Map()
  for (const item of items || []) {
    const materialId = Number(item.materialId)
    const quantity = Math.max(Math.round(Number(item.quantity) || 0), 0)
    if (!Number.isInteger(materialId) || materialId <= 0) continue
    wanted.set(materialId, (wanted.get(materialId) || 0) + quantity)
    if (item.pricePerUnit != null && item.pricePerUnit !== '') {
      prices.set(materialId, money(item.pricePerUnit))
    }
  }

  return db.transaction(async (tx) => {
    const [product] = await tx
      .select({ id: schema.products.id, name: schema.products.name, status: schema.products.status })
      .from(schema.products)
      .where(eq(schema.products.id, productId))
    if (!product) throw createError({ statusCode: 404, statusMessage: 'Proyek tidak ditemukan' })

    const existing = await tx
      .select()
      .from(schema.materialUsages)
      .where(eq(schema.materialUsages.productId, productId))
    const grouped = new Map()
    for (const row of existing) {
      const list = grouped.get(row.materialId) || []
      list.push(row)
      grouped.set(row.materialId, list)
    }

    for (const [materialId, price] of prices) {
      await tx
        .update(schema.materials)
        .set({ pricePerUnit: price })
        .where(eq(schema.materials.id, materialId))
    }

    const ids = new Set([...wanted.keys(), ...grouped.keys()])
    for (const materialId of ids) {
      const next = wanted.get(materialId) || 0
      const rows = grouped.get(materialId) || []
      const prev = rows.reduce((sum, row) => sum + Math.max(Math.round(Number(row.quantity) || 0), 0), 0)
      if (next === prev) continue
      if (next > prev) {
        await insertMaterialUsage(tx, schema, {
          materialId,
          productId,
          quantity: next - prev,
          date: localDateStr()
        })
      } else {
        await reduceMaterialUsages(tx, schema, rows, prev - next)
      }
    }

    const pricedIds = [...ids]
    if (pricedIds.length) {
      const mats = await tx.select().from(schema.materials).where(inArray(schema.materials.id, pricedIds))
      for (const mat of mats) {
        await applyUsagePrices(tx, schema, {
          productId,
          materialId: mat.id,
          unitPrice: mat.pricePerUnit
        })
      }
    }

    const usages = await loadMaterialUsagesByProduct(tx, schema, [productId])
    return usages.get(productId) || []
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
