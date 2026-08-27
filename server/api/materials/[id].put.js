import { eq } from 'drizzle-orm'
import { useDb, schema } from '../../db/index.js'
import { requireAdmin } from '../../utils/rbac.js'
import { parseMaterialType, parseLowStockQuantity, stockStatusFromQuantity } from '../../utils/materialType.js'

export default defineEventHandler(async (event) => {
  requireAdmin(event)
  const id = Number(getRouterParam(event, 'id'))
  const body = await readBody(event)
  const stockQuantity = Number(body.stockQuantity) || 0
  const lowStockQuantity = parseLowStockQuantity(body.lowStockQuantity)
  const db = useDb()
  const rows = await db
    .update(schema.materials)
    .set({
      name: body.name,
      type: parseMaterialType(body.type, 'consumable'),
      unit: body.unit || 'pack',
      pricePerUnit: Math.round(Number(body.pricePerUnit) || 0),
      stockQuantity,
      lowStockQuantity,
      stockStatus: stockStatusFromQuantity(stockQuantity, lowStockQuantity),
      supplier: body.supplier || null
    })
    .where(eq(schema.materials.id, id))
    .returning()
  if (!rows.length) throw createError({ statusCode: 404, statusMessage: 'Perlengkapan tidak ditemukan' })
  await logAudit(event, { action: 'update', entity: 'material', entityId: id, summary: `Ubah perlengkapan "${rows[0].name}"` })
  return rows[0]
})
