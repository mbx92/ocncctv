import { useDb, schema } from '../../db/index.js'
import { requireAdmin } from '../../utils/rbac.js'
import { logAudit } from '../../utils/audit.js'
import { applyPackagingStockRepair } from '../../utils/stockRepair.js'

export default defineEventHandler(async (event) => {
  requireAdmin(event)
  const db = useDb()
  const result = await db.transaction((tx) => applyPackagingStockRepair(tx, schema))
  await logAudit(event, {
    action: 'update',
    entity: 'packaging',
    summary: `Perbaiki data stok produk (${result.changed.length} stok, ${result.lotsCreated} lot)`
  })
  return result
})
