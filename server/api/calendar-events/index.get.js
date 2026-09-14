import { and, desc, gte, lte } from 'drizzle-orm'
import { useDb, schema } from '../../db/index.js'

export default defineEventHandler(async (event) => {
  const q = getQuery(event)
  const db = useDb()
  const conds = []
  if (q.dateFrom) conds.push(gte(schema.calendarEvents.date, q.dateFrom))
  if (q.dateTo) conds.push(lte(schema.calendarEvents.date, q.dateTo))
  return db
    .select()
    .from(schema.calendarEvents)
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(schema.calendarEvents.date), desc(schema.calendarEvents.id))
})
