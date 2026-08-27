import { and, desc, eq, gte, lte } from 'drizzle-orm'
import { useDb, schema } from '../../db/index.js'
import { loadRabLines, withRabTotals } from '../../utils/customOrders.js'

export default defineEventHandler(async (event) => {
  const q = getQuery(event)
  const db = useDb()
  const conds = []
  if (q.status) conds.push(eq(schema.customOrders.status, q.status))
  if (q.dateFrom) conds.push(gte(schema.customOrders.date, q.dateFrom))
  if (q.dateTo) conds.push(lte(schema.customOrders.date, q.dateTo))

  const rows = await db
    .select()
    .from(schema.customOrders)
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(schema.customOrders.date), desc(schema.customOrders.id))

  const lineMap = await loadRabLines(
    db,
    rows.map((r) => r.id)
  )
  return rows.map((row) => withRabTotals(row, lineMap.get(row.id) || []))
})
