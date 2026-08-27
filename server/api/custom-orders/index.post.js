import { useDb, schema } from '../../db/index.js'
import { logAudit } from '../../utils/audit.js'
import { parseCustomOrderBody, replaceRabLines, withRabTotals } from '../../utils/customOrders.js'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { header, lines } = parseCustomOrderBody(body, { allowEmptyLines: true })
  const db = useDb()
  const row = await db.transaction(async (tx) => {
    const [created] = await tx
      .insert(schema.customOrders)
      .values({ ...header, status: 'draft', channel: 'direct' })
      .returning()
    await replaceRabLines(tx, created.id, lines || [])
    return created
  })
  await logAudit(event, {
    action: 'create',
    entity: 'custom_order',
    entityId: row.id,
    summary: `RAB "${row.title}" untuk ${row.customerName}`
  })
  return withRabTotals(row, lines || [])
})
