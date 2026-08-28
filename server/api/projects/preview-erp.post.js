import { requireAdmin } from '../../utils/rbac.js'
import { erpSyncConfig, getSettings } from '../../utils/settings.js'
import { previewErpProjectsForSync } from '../../utils/erpProjectSync.js'

export default defineEventHandler(async (event) => {
  requireAdmin(event)
  const body = (await readBody(event).catch(() => null)) || {}
  const settings = await getSettings()
  const runtime = useRuntimeConfig().erpSync || {}
  const saved = erpSyncConfig(settings, runtime)
  const baseUrl = String(body.erpSyncBaseUrl ?? saved.baseUrl ?? '')
    .trim()
    .replace(/\/+$/, '')
  const incomingKey = String(body.erpSyncApiKey || '').trim()
  const apiKey = incomingKey || saved.apiKey
  try {
    return await previewErpProjectsForSync({ baseUrl, apiKey })
  } catch (e) {
    throw createError({
      statusCode: e.statusCode || 502,
      statusMessage: e.message || 'Gagal mengambil daftar proyek dari ERP'
    })
  }
})
