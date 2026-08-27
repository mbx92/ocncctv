import { eq } from 'drizzle-orm'
import { useDb, schema } from '../../db/index.js'
import { logAudit } from '../../utils/audit.js'
import {
  loadRabLines,
  parseCustomOrderBody,
  rabIsLocked,
  replaceRabLines,
  withRabTotals
} from '../../utils/customOrders.js'

export default defineEventHandler(async (event) => {
  const id = Number(getRouterParam(event, 'id'))
  const body = await readBody(event)
  const { header, lines } = parseCustomOrderBody(body, { allowEmptyLines: true })
  const db = useDb()
  const { updated, savedLines } = await db.transaction(async (tx) => {
    const [existing] = await tx.select().from(schema.customOrders).where(eq(schema.customOrders.id, id))
    if (!existing) throw createError({ statusCode: 404, statusMessage: 'RAB tidak ditemukan' })
    if (rabIsLocked(existing.status)) {
      throw createError({ statusCode: 400, statusMessage: 'RAB yang sudah Deal atau Tidak deal tidak bisa diubah' })
    }
    const [row] = await tx
      .update(schema.customOrders)
      .set(header)
      .where(eq(schema.customOrders.id, id))
      .returning()
    if (lines) await replaceRabLines(tx, id, lines)
    const lineMap = lines ? null : await loadRabLines(tx, [id])
    return { updated: row, savedLines: lines || lineMap.get(id) || [] }
  })
  await logAudit(event, {
    action: 'update',
    entity: 'custom_order',
    entityId: id,
    summary: `Ubah RAB "${updated.title}"`
  })
  return withRabTotals(updated, savedLines)
})
