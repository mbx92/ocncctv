import { useDb, schema } from '../../db/index.js'
import { requireAdmin } from '../../utils/rbac.js'
import { previewPackagingStockRepair } from '../../utils/stockRepair.js'

export default defineEventHandler(async (event) => {
  requireAdmin(event)
  const items = await previewPackagingStockRepair(useDb(), schema)
  return {
    items,
    changedCount: items.filter((row) => row.changed).length
  }
})
