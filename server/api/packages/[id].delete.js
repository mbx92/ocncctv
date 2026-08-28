import { eq } from 'drizzle-orm'
import { useDb, schema } from '../../db/index.js'
import { logAudit } from '../../utils/audit.js'

export default defineEventHandler(async (event) => {
  const id = Number(getRouterParam(event, 'id'))
  const db = useDb()
  const [existing] = await db.select().from(schema.packages).where(eq(schema.packages.id, id))
  if (!existing) throw createError({ statusCode: 404, statusMessage: 'Paket tidak ditemukan' })
  await db.delete(schema.packages).where(eq(schema.packages.id, id))
  await logAudit(event, {
    action: 'delete',
    entity: 'package',
    entityId: id,
    summary: `Hapus paket "${existing.name}"`
  })
  return { ok: true }
})
