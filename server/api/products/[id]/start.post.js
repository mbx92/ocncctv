import { eq } from 'drizzle-orm'
import { useDb, schema } from '../../../db/index.js'
import { logAudit } from '../../../utils/audit.js'
import { normalizeProductStatus, parseYmd } from '../../../utils/projectStatus.js'
import { localDateStr } from '../../../utils/dates.js'

export default defineEventHandler(async (event) => {
  const id = Number(getRouterParam(event, 'id'))
  const body = await readBody(event).catch(() => ({}))
  const startedAt = parseYmd(body?.date) || localDateStr()
  const plannedStartDate = parseYmd(body?.plannedStartDate)
  const db = useDb()
  const [existing] = await db.select().from(schema.products).where(eq(schema.products.id, id))
  if (!existing) throw createError({ statusCode: 404, statusMessage: 'Proyek tidak ditemukan' })
  if (normalizeProductStatus(existing.status) !== 'waiting') {
    throw createError({ statusCode: 400, statusMessage: 'Hanya proyek Menunggu yang bisa dimulai' })
  }
  const patch = { status: 'in_progress', startedAt }
  if (plannedStartDate || existing.plannedStartDate) {
    patch.plannedStartDate = plannedStartDate || existing.plannedStartDate
  }
  const [row] = await db.update(schema.products).set(patch).where(eq(schema.products.id, id)).returning()
  await logAudit(event, {
    action: 'update',
    entity: 'product',
    entityId: id,
    summary: `Mulai proyek "${row.name}" (${startedAt})`
  })
  return row
})
