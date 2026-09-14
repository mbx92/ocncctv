import { eq } from 'drizzle-orm'
import { useDb, schema } from '../../db/index.js'
import { logAudit } from '../../utils/audit.js'

export default defineEventHandler(async (event) => {
  const id = Number(getRouterParam(event, 'id'))
  const db = useDb()
  const [existing] = await db.select().from(schema.calendarEvents).where(eq(schema.calendarEvents.id, id))
  if (!existing) throw createError({ statusCode: 404, statusMessage: 'Jadwal tidak ditemukan' })
  await db.delete(schema.calendarEvents).where(eq(schema.calendarEvents.id, id))
  await logAudit(event, {
    action: 'delete',
    entity: 'calendar_event',
    entityId: id,
    summary: `Hapus jadwal "${existing.title}" ${existing.date}`
  })
  return { ok: true }
})
