import { requireAdmin } from '../../utils/rbac.js'
import { logAudit } from '../../utils/audit.js'
import { backupDumpFilename, createDatabaseDump } from '../../utils/dbBackup.js'

export default defineEventHandler(async (event) => {
  requireAdmin(event)
  const config = useRuntimeConfig()
  const sql = await createDatabaseDump(config.databaseUrl)
  const filename = backupDumpFilename()
  await logAudit(event, {
    action: 'backup',
    entity: 'database',
    summary: `SQL dump ${filename} (${sql.length} byte)`
  })
  setResponseHeaders(event, {
    'Content-Type': 'application/sql; charset=utf-8',
    'Content-Disposition': `attachment; filename="${filename}"`,
    'Cache-Control': 'no-store'
  })
  return send(event, sql)
})
