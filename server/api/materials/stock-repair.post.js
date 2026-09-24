import { useDb, schema } from '../../db/index.js'
import { requireAdmin } from '../../utils/rbac.js'
import { logAudit } from '../../utils/audit.js'
import { applyMaterialStockRepair } from '../../utils/stockRepair.js'

export default defineEventHandler(async (event) => {
  requireAdmin(event)
  const db = useDb()
  const result = await db.transaction((tx) => applyMaterialStockRepair(tx, schema))
  await logAudit(event, {
    action: 'update',
    entity: 'material',
    summary: `Perbaiki data stok perlengkapan (${result.changed.length} item)`
  })
  return result
})
