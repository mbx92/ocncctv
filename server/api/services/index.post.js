import { useDb, schema } from '../../db/index.js'
import { requireAdmin } from '../../utils/rbac.js'
import { logAudit } from '../../utils/audit.js'
import { parseServiceBody } from '../../utils/services.js'

export default defineEventHandler(async (event) => {
  requireAdmin(event)
  const values = parseServiceBody(await readBody(event))
  const db = useDb()
  const [row] = await db.insert(schema.services).values(values).returning()
  await logAudit(event, {
    action: 'create',
    entity: 'service',
    entityId: row.id,
    summary: `Tambah jasa "${row.name}"`
  })
  return row
})
