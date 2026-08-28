import { eq } from 'drizzle-orm'
import { useDb, schema } from '../../db/index.js'
import { logAudit } from '../../utils/audit.js'

export default defineEventHandler(async (event) => {
  const id = Number(getRouterParam(event, 'id'))
  const db = useDb()
  const rows = await db.select().from(schema.technicians).where(eq(schema.technicians.id, id))
  if (!rows.length) throw createError({ statusCode: 404, statusMessage: 'Teknisi tidak ditemukan' })
  await db.delete(schema.technicians).where(eq(schema.technicians.id, id))
  await logAudit(event, {
    action: 'delete',
    entity: 'technician',
    entityId: id,
    summary: `Hapus teknisi "${rows[0].name}"`
  })
  return { ok: true }
})
