import { requireAdmin } from '../../utils/rbac.js'
import { runCatalogSync } from '../../utils/catalogSync.js'

export default defineEventHandler(async (event) => {
  requireAdmin(event)
  event.node.req.setTimeout?.(320000)
  return runCatalogSync({ source: 'manual', event })
})
