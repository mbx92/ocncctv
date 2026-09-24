import { eq, sql } from 'drizzle-orm'
import { applyRabAdjustments } from './projectLines.js'

function qtyOf(value) {
  return Math.max(Math.round(Number(value) || 0), 0)
}

function addQty(map, packagingId, quantity) {
  const id = Number(packagingId)
  const qty = qtyOf(quantity)
  if (!id || qty <= 0) return
  map.set(id, (map.get(id) || 0) + qty)
}

async function desiredPackagingQty(tx, schema, productId) {
  const desired = new Map()
  const extras = await tx
    .select({
      lineType: schema.projectExtraLines.lineType,
      packagingId: schema.projectExtraLines.packagingId,
      quantity: schema.projectExtraLines.quantity
    })
    .from(schema.projectExtraLines)
    .where(eq(schema.projectExtraLines.productId, productId))
  for (const line of extras) {
    if (line.lineType === 'product') addQty(desired, line.packagingId, line.quantity)
  }

  const [rab] = await tx
    .select({ id: schema.customOrders.id })
    .from(schema.customOrders)
    .where(eq(schema.customOrders.projectId, productId))
  if (!rab) return desired

  const [rabLines, adjustments] = await Promise.all([
    tx
      .select({
        id: schema.customOrderLines.id,
        lineType: schema.customOrderLines.lineType,
        packagingId: schema.customOrderLines.packagingId,
        quantity: schema.customOrderLines.quantity,
        name: schema.customOrderLines.name
      })
      .from(schema.customOrderLines)
      .where(eq(schema.customOrderLines.customOrderId, rab.id)),
    tx
      .select({
        customOrderLineId: schema.projectRabAdjustments.customOrderLineId,
        quantity: schema.projectRabAdjustments.quantity
      })
      .from(schema.projectRabAdjustments)
      .where(eq(schema.projectRabAdjustments.productId, productId))
  ])
  for (const line of applyRabAdjustments(rabLines, adjustments)) {
    if (line.lineType === 'product') addQty(desired, line.packagingId, line.quantity)
  }
  return desired
}

export async function syncProjectPackagingStock(tx, schema, productId) {
  const desired = await desiredPackagingQty(tx, schema, productId)
  const existing = await tx
    .select()
    .from(schema.packagingUsages)
    .where(eq(schema.packagingUsages.productId, productId))
  const previous = new Map(existing.map((row) => [row.packagingId, row]))
  const ids = new Set([...desired.keys(), ...previous.keys()])

  for (const packagingId of ids) {
    const next = desired.get(packagingId) || 0
    const prevRow = previous.get(packagingId)
    const prev = prevRow?.quantity || 0
    const delta = next - prev
    if (delta > 0) {
      const [item] = await tx.select().from(schema.packaging).where(eq(schema.packaging.id, packagingId))
      if (!item) throw createError({ statusCode: 400, statusMessage: 'Produk stok tidak ditemukan' })
      if ((Number(item.stockQuantity) || 0) < delta) {
        throw createError({
          statusCode: 400,
          statusMessage: `Stok "${item.name}" tidak cukup. Sisa ${item.stockQuantity} ${item.unit}, proyek butuh ${delta} lagi.`
        })
      }
    }
    if (delta !== 0) {
      await tx
        .update(schema.packaging)
        .set({ stockQuantity: sql`${schema.packaging.stockQuantity} - ${delta}` })
        .where(eq(schema.packaging.id, packagingId))
    }
    if (next <= 0 && prevRow) {
      await tx.delete(schema.packagingUsages).where(eq(schema.packagingUsages.id, prevRow.id))
    } else if (next > 0 && prevRow) {
      await tx.update(schema.packagingUsages).set({ quantity: next }).where(eq(schema.packagingUsages.id, prevRow.id))
    } else if (next > 0) {
      await tx.insert(schema.packagingUsages).values({ productId, packagingId, quantity: next })
    }
  }
}

export async function restoreProjectPackagingStock(tx, schema, productId) {
  const rows = await tx.select().from(schema.packagingUsages).where(eq(schema.packagingUsages.productId, productId))
  for (const row of rows) {
    await tx
      .update(schema.packaging)
      .set({ stockQuantity: sql`${schema.packaging.stockQuantity} + ${row.quantity}` })
      .where(eq(schema.packaging.id, row.packagingId))
  }
}
