import { useDb, schema } from '../../../db/index.js'
import { logAudit } from '../../../utils/audit.js'
import { lotCode, usePackagingLot } from '../../../utils/packagingLots.js'
import { localDateStr } from '../../../utils/dates.js'

export default defineEventHandler(async (event) => {
  const lotId = Number(getRouterParam(event, 'id'))
  const body = await readBody(event)
  const db = useDb()
  const result = await db.transaction((tx) =>
    usePackagingLot(tx, schema, {
      lotId,
      projectId: Number(body.projectId),
      quantity: body.quantity,
      date: body.date || localDateStr()
    })
  )
  await logAudit(event, {
    action: 'create',
    entity: 'packaging',
    entityId: result.lot.packagingId,
    summary: `Pakai sisa ${lotCode(result.lot.id)} ${result.move.quantity} ${result.item.unit} di proyek "${result.project.name}"`
  })
  return result.move
})
