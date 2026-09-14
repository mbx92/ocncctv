import { useDb, schema } from '../../db/index.js'
import { logAudit } from '../../utils/audit.js'
import { parseCalendarEventBody } from '../../utils/calendarEvent.js'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const values = parseCalendarEventBody(body)
  const db = useDb()
  const [row] = await db.insert(schema.calendarEvents).values(values).returning()
  await logAudit(event, {
    action: 'create',
    entity: 'calendar_event',
    entityId: row.id,
    summary: `Jadwal ${row.kind} "${row.title}" ${row.date}`
  })
  return row
})
