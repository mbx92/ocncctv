import { eq } from 'drizzle-orm'
import { useDb, schema } from '../../db/index.js'
import { logAudit } from '../../utils/audit.js'
import { deleteMaterialUsage } from '../../utils/materialUsage.js'

export default defineEventHandler(async (event) => {
  const id = Number(getRouterParam(event, 'id'))
  const db = useDb()
  const usage = await deleteMaterialUsage(db, schema, id)
  const [material] = await db
    .select({ name: schema.materials.name, unit: schema.materials.unit })
    .from(schema.materials)
    .where(eq(schema.materials.id, usage.materialId))
  await logAudit(event, {
    action: 'delete',
    entity: 'material',
    entityId: usage.materialId,
    summary: `Batalkan pemakaian "${material?.name || usage.materialId}" ${usage.quantity} ${material?.unit || ''}`.trim()
  })
  return { ok: true }
})