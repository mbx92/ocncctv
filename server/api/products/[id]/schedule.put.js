import { eq } from 'drizzle-orm'
import { useDb, schema } from '../../../db/index.js'
import { logAudit } from '../../../utils/audit.js'
import { normalizeProductStatus, parseYmd } from '../../../utils/projectStatus.js'

export default defineEventHandler(async (event) => {
  const id = Number(getRouterParam(event, 'id'))
  const body = await readBody(event).catch(() => ({}))
  const plannedStartDate = parseYmd(body?.plannedStartDate)
  const db = useDb()
  const [existing] = await db.select().from(schema.products).where(eq(schema.products.id, id))
  if (!existing) throw createError({ statusCode: 404, statusMessage: 'Proyek tidak ditemukan' })
  const phase = normalizeProductStatus(existing.status)
  if (phase !== 'waiting' && phase !== 'pending') {
    throw createError({ statusCode: 400, statusMessage: 'Tanggal rencana hanya bisa diubah saat status Menunggu atau Pending' })
  }
  const [row] = await db
    .update(schema.products)
    .set({ plannedStartDate })
    .where(eq(schema.products.id, id))
    .returning()
  await logAudit(event, {
    action: 'update',
    entity: 'product',
    entityId: id,
    summary: plannedStartDate
      ? `Jadwal mulai proyek "${row.name}": ${plannedStartDate}`
      : `Hapus jadwal mulai proyek "${row.name}"`
  })
  return row
})
