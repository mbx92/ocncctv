import { useDb, schema } from '../../db/index.js'
import { logAudit } from '../../utils/audit.js'
import { lotCode, undoPackagingLotMove } from '../../utils/packagingLots.js'

export default defineEventHandler(async (event) => {
  const id = Number(getRouterParam(event, 'id'))
  const db = useDb()
  const result = await db.transaction((tx) => undoPackagingLotMove(tx, schema, id))
  await logAudit(event, {
    action: 'delete',
    entity: 'packaging',
    entityId: result.lot?.packagingId || null,
    summary: `Batalkan pemakaian ${result.lot ? lotCode(result.lot.id) : ''} ${result.move.quantity}`.trim()
  })
  return { ok: true }
})
