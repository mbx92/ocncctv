import { eq } from 'drizzle-orm'
import { useDb, schema } from '../../../db/index.js'
import { requireAdmin } from '../../../utils/rbac.js'
import { logAudit } from '../../../utils/audit.js'
import { syncProjectMaterialChecklist } from '../../../utils/materialUsage.js'
import { normalizeProductStatus } from '../../../utils/projectStatus.js'
import { parseConsumableLotSale } from '../../../utils/consumableLot.js'

export default defineEventHandler(async (event) => {
  requireAdmin(event)
  const id = Number(getRouterParam(event, 'id'))
  const body = await readBody(event)
  const db = useDb()
  const [product] = await db.select({ id: schema.products.id, name: schema.products.name, status: schema.products.status }).from(schema.products).where(eq(schema.products.id, id))
  if (!product) throw createError({ statusCode: 404, statusMessage: 'Proyek tidak ditemukan' })
  if (normalizeProductStatus(product.status) === 'done') {
    throw createError({ statusCode: 400, statusMessage: 'Proyek yang sudah selesai tidak bisa diubah perlengkapannya' })
  }
  const usages = await syncProjectMaterialChecklist(db, schema, id, Array.isArray(body?.items) ? body.items : [])
  const lotSale = parseConsumableLotSale(body?.lotSale)
  await db.update(schema.products).set({ consumableLotSale: lotSale }).where(eq(schema.products.id, id))
  await logAudit(event, {
    action: 'update',
    entity: 'product',
    entityId: id,
    summary: `Checklist perlengkapan proyek "${product.name}"`
  })
  return { usages, lotSale }
})
