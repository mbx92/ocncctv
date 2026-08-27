import { eq } from 'drizzle-orm'
import { useDb, schema } from '../../../db/index.js'
import { logAudit } from '../../../utils/audit.js'
import { normalizeProductStatus, parseYmd } from '../../../utils/projectStatus.js'
import { localDateStr } from '../../../utils/dates.js'

export default defineEventHandler(async (event) => {
  const id = Number(getRouterParam(event, 'id'))
  const body = await readBody(event).catch(() => ({}))
  const completedAt = parseYmd(body?.date) || localDateStr()
  const db = useDb()
  const [existing] = await db.select().from(schema.products).where(eq(schema.products.id, id))
  if (!existing) throw createError({ statusCode: 404, statusMessage: 'Proyek tidak ditemukan' })
  if (normalizeProductStatus(existing.status) !== 'in_progress') {
    throw createError({ statusCode: 400, statusMessage: 'Hanya proyek yang sudah dimulai yang bisa diselesaikan' })
  }
  const [row] = await db
    .update(schema.products)
    .set({ status: 'done', completedAt })
    .where(eq(schema.products.id, id))
    .returning()
  await logAudit(event, {
    action: 'update',
    entity: 'product',
    entityId: id,
    summary: `Selesai proyek "${row.name}" (${completedAt})`
  })
  return row
})
