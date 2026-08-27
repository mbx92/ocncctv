import { eq } from 'drizzle-orm'
import { useDb, schema } from '../../../db/index.js'
import { logAudit } from '../../../utils/audit.js'
import { loadRabLines, RAB_OPEN_STATUSES, withRabTotals } from '../../../utils/customOrders.js'

export default defineEventHandler(async (event) => {
  const id = Number(getRouterParam(event, 'id'))
  const db = useDb()
  const row = await db.transaction(async (tx) => {
    const [existing] = await tx.select().from(schema.customOrders).where(eq(schema.customOrders.id, id))
    if (!existing) throw createError({ statusCode: 404, statusMessage: 'RAB tidak ditemukan' })
    if (!RAB_OPEN_STATUSES.includes(existing.status)) {
      throw createError({ statusCode: 400, statusMessage: 'RAB ini tidak bisa ditandai dikirim' })
    }
    if (existing.status === 'sent') return existing
    const lineMap = await loadRabLines(tx, [id])
    if (!(lineMap.get(id) || []).length) {
      throw createError({ statusCode: 400, statusMessage: 'Isi minimal satu baris sebelum menandai dikirim' })
    }
    const [updated] = await tx
      .update(schema.customOrders)
      .set({ status: 'sent' })
      .where(eq(schema.customOrders.id, id))
      .returning()
    return updated
  })
  await logAudit(event, {
    action: 'update',
    entity: 'custom_order',
    entityId: id,
    summary: `RAB "${row.title}" dikirim ke pelanggan`
  })
  const lineMap = await loadRabLines(db, [id])
  return withRabTotals(row, lineMap.get(id) || [])
})
