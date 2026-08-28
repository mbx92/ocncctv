import { useDb, schema } from '../../db/index.js'
import { requireAdmin } from '../../utils/rbac.js'
import { logAudit } from '../../utils/audit.js'
import { parseMaterialType, parseLowStockQuantity, parseMaterialStockQuantity, stockStatusFromQuantity } from '../../utils/materialType.js'

export default defineEventHandler(async (event) => {
  requireAdmin(event)
  const body = await readBody(event)
  if (!body.name) throw createError({ statusCode: 400, statusMessage: 'Nama wajib diisi' })
  const stockQuantity = parseMaterialStockQuantity(body.stockQuantity)
  const lowStockQuantity = parseLowStockQuantity(body.lowStockQuantity)
  const db = useDb()
  const rows = await db
    .insert(schema.materials)
    .values({
      name: body.name,
      type: parseMaterialType(body.type),
      unit: body.unit || 'pack',
      pricePerUnit: Math.round(Number(body.pricePerUnit) || 0),
      stockQuantity,
      lowStockQuantity,
      stockStatus: stockStatusFromQuantity(stockQuantity, lowStockQuantity),
      supplier: body.supplier || null
    })
    .returning()
  await logAudit(event, { action: 'create', entity: 'material', entityId: rows[0].id, summary: `Tambah perlengkapan "${rows[0].name}"` })
  return rows[0]
})
