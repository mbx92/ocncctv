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
    if (existing.projectId || existing.status === 'deal') {
      throw createError({ statusCode: 400, statusMessage: 'RAB yang sudah Deal tidak bisa ditandai Tidak deal' })
    }
    if (!RAB_OPEN_STATUSES.includes(existing.status)) {
      throw createError({ statusCode: 400, statusMessage: 'RAB ini tidak bisa ditandai Tidak deal' })
    }
    const [updated] = await tx
      .update(schema.customOrders)
      .set({ status: 'lost' })
      .where(eq(schema.customOrders.id, id))
      .returning()
    return updated
  })
  await logAudit(event, {
    action: 'update',
    entity: 'custom_order',
    entityId: id,
    summary: `RAB "${row.title}" Tidak deal`
  })
  const lineMap = await loadRabLines(db, [id])
  return withRabTotals(row, lineMap.get(id) || [])
})
