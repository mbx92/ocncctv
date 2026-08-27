import { eq } from 'drizzle-orm'
import { useDb, schema } from '../../db/index.js'
import { requireAdmin } from '../../utils/rbac.js'
import { logAudit } from '../../utils/audit.js'
import { parseServiceBody } from '../../utils/services.js'

export default defineEventHandler(async (event) => {
  requireAdmin(event)
  const id = Number(getRouterParam(event, 'id'))
  const values = parseServiceBody(await readBody(event))
  const db = useDb()
  const [row] = await db.update(schema.services).set(values).where(eq(schema.services.id, id)).returning()
  if (!row) throw createError({ statusCode: 404, statusMessage: 'Jasa tidak ditemukan' })
  await logAudit(event, {
    action: 'update',
    entity: 'service',
    entityId: id,
    summary: `Ubah jasa "${row.name}"`
  })
  return row
})
