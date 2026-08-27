import { eq } from 'drizzle-orm'
import { useDb, schema } from '../../db/index.js'
import { requireAdmin } from '../../utils/rbac.js'
import { logAudit } from '../../utils/audit.js'

export default defineEventHandler(async (event) => {
  requireAdmin(event)
  const id = Number(getRouterParam(event, 'id'))
  const db = useDb()
  const [existing] = await db.select().from(schema.services).where(eq(schema.services.id, id))
  if (!existing) throw createError({ statusCode: 404, statusMessage: 'Jasa tidak ditemukan' })
  await db.delete(schema.services).where(eq(schema.services.id, id))
  await logAudit(event, {
    action: 'delete',
    entity: 'service',
    entityId: id,
    summary: `Hapus jasa "${existing.name}"`
  })
  return { ok: true }
})
