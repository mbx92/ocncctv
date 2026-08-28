import { requireAdmin } from '../../utils/rbac.js'
import { logAudit } from '../../utils/audit.js'
import { erpSyncConfig, getSettings } from '../../utils/settings.js'
import { syncCompletedErpProjects } from '../../utils/erpProjectSync.js'

export default defineEventHandler(async (event) => {
  requireAdmin(event)
  const settings = await getSettings()
  const runtime = useRuntimeConfig().erpSync || {}
  const { baseUrl, apiKey } = erpSyncConfig(settings, runtime)
  try {
    const summary = await syncCompletedErpProjects({ baseUrl, apiKey })
    const message = `Sync ERP: ${summary.created} baru, ${summary.updated} diperbarui, ${summary.itemLines} baris item, ${summary.wageRows} upah teknisi${summary.companyName ? ` (${summary.companyName})` : ''}.`
    await logAudit(event, {
      action: 'update',
      entity: 'product',
      summary: message
    })
    return { message, ...summary, lastSyncedAt: new Date().toISOString() }
  } catch (e) {
    throw createError({
      statusCode: e.statusCode || 502,
      statusMessage: e.message || 'Gagal sync proyek dari ERP'
    })
  }
})
