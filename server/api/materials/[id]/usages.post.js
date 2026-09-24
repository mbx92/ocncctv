import { useDb, schema } from '../../../db/index.js'
import { logAudit } from '../../../utils/audit.js'
import { recordMaterialUsage } from '../../../utils/materialUsage.js'

export default defineEventHandler(async (event) => {
  const materialId = Number(getRouterParam(event, 'id'))
  const body = await readBody(event)
  const db = useDb()
  const result = await recordMaterialUsage(db, schema, {
    materialId,
    productId: Number(body.productId),
    quantity: body.quantity,
    date: body.date,
    notes: body.notes
  })
  await logAudit(event, {
    action: 'create',
    entity: 'material',
    entityId: materialId,
    summary: `Pakai "${result.materialName}" ${result.usage.quantity} ${result.unit} di proyek "${result.productName}"`
  })
  return result.usage
})
