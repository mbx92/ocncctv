import { eq } from 'drizzle-orm'
import { useDb, schema } from '../../../db/index.js'
import { logAudit } from '../../../utils/audit.js'
import { parseCustomOrderBody, replaceRabLines, withRabTotals } from '../../../utils/customOrders.js'

export default defineEventHandler(async (event) => {
  const id = Number(getRouterParam(event, 'id'))
  const body = (await readBody(event).catch(() => null)) || {}
  const db = useDb()
  const result = await db.transaction(async (tx) => {
    const [visit] = await tx.select().from(schema.calendarEvents).where(eq(schema.calendarEvents.id, id))
    if (!visit) throw createError({ statusCode: 404, statusMessage: 'Jadwal tidak ditemukan' })
    if (visit.customOrderId) {
      throw createError({ statusCode: 400, statusMessage: 'Jadwal ini sudah punya RAB' })
    }
    const customerName = String(body.customerName || visit.customerName || '').trim()
    if (!customerName) {
      throw createError({ statusCode: 400, statusMessage: 'Nama pelanggan wajib diisi untuk membuat RAB' })
    }
    const { header, lines } = parseCustomOrderBody(
      {
        date: visit.date,
        customerName,
        title: String(body.title || visit.title || '').trim() || customerName,
        notes: body.notes != null ? body.notes : visit.notes,
        jobType: body.jobType || 'install',
        lines: []
      },
      { allowEmptyLines: true, requireJobType: true }
    )
    const [created] = await tx
      .insert(schema.customOrders)
      .values({ ...header, status: 'draft', channel: 'direct' })
      .returning()
    await replaceRabLines(tx, created.id, lines || [])
    const [updated] = await tx
      .update(schema.calendarEvents)
      .set({ customOrderId: created.id, customerName })
      .where(eq(schema.calendarEvents.id, id))
      .returning()
    return { visit: updated, order: created, lines: lines || [] }
  })
  await logAudit(event, {
    action: 'create',
    entity: 'custom_order',
    entityId: result.order.id,
    summary: `RAB "${result.order.title}" dari jadwal ${id}`
  })
  return {
    ...result.visit,
    rab: withRabTotals(result.order, result.lines)
  }
})
