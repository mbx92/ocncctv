import { eq } from 'drizzle-orm'
import { stockStatusFromQuantity } from './materialType.js'

export async function applyMaterialStockDelta(tx, schema, { id, delta, pricePerUnit }) {
  const [row] = await tx.select().from(schema.materials).where(eq(schema.materials.id, id))
  if (!row) return null
  const stockQuantity = Math.max(
    Math.round((Number(row.stockQuantity) || 0) + (Number(delta) || 0)),
    0
  )
  const patch = {
    stockQuantity,
    stockStatus: stockStatusFromQuantity(stockQuantity, row.lowStockQuantity)
  }
  if (pricePerUnit != null && Number.isFinite(Number(pricePerUnit))) {
    patch.pricePerUnit = Math.round(Number(pricePerUnit))
  }
  const [updated] = await tx
    .update(schema.materials)
    .set(patch)
    .where(eq(schema.materials.id, id))
    .returning()
  return updated
}
