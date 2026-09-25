import { eq } from 'drizzle-orm'
import { useDb, schema } from '../../../db/index.js'
import { requireAdmin } from '../../../utils/rbac.js'
import { logAudit } from '../../../utils/audit.js'
import { resyncProjectSale } from '../../../utils/saleResync.js'

export default defineEventHandler(async (event) => {
  requireAdmin(event)
  const id = Number(getRouterParam(event, 'id'))
  const db = useDb()
  const [sale] = await db
    .select({ id: schema.sales.id, productId: schema.sales.productId, invoiceNumber: schema.sales.invoiceNumber })
    .from(schema.sales)
    .where(eq(schema.sales.id, id))
  if (!sale?.productId) throw createError({ statusCode: 404, statusMessage: 'Penjualan tidak ditemukan' })

  const result = await db.transaction((tx) => resyncProjectSale(tx, schema, sale.productId))
  if (result.updated) {
    await logAudit(event, {
      action: 'update',
      entity: 'sale',
      entityId: sale.id,
      summary: `Hitung ulang ${sale.invoiceNumber || `penjualan id ${sale.id}`} dari lingkup proyek (${result.previous} → ${result.current})`
    })
  }
  return result
})
