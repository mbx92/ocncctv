import { eq } from 'drizzle-orm'
import { useDb, schema } from '../../db/index.js'
import { logAudit } from '../../utils/audit.js'
import { parseCalendarEventBody } from '../../utils/calendarEvent.js'
import { queueReminderDispatch } from '../../utils/reminders.js'

export default defineEventHandler(async (event) => {
  const id = Number(getRouterParam(event, 'id'))
  const body = await readBody(event)
  const values = parseCalendarEventBody(body)
  const db = useDb()
  const [existing] = await db.select().from(schema.calendarEvents).where(eq(schema.calendarEvents.id, id))
  if (!existing) throw createError({ statusCode: 404, statusMessage: 'Jadwal tidak ditemukan' })
  const [row] = await db
    .update(schema.calendarEvents)
    .set(values)
    .where(eq(schema.calendarEvents.id, id))
    .returning()
  await logAudit(event, {
    action: 'update',
    entity: 'calendar_event',
    entityId: id,
    summary: `Ubah jadwal "${row.title}" ${row.date}`
  })
  queueReminderDispatch('calendar-update')
  return row
})
