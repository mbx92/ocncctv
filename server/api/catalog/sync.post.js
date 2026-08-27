import { useDb } from '../../db/index.js'
import { requireAdmin } from '../../utils/rbac.js'
import { logAudit } from '../../utils/audit.js'
import { catalogSupplierName, lastCatalogSyncedAt, syncAllSheets } from '../../utils/supplierCatalog.js'
import { getSupplierCatalogSettings } from '../../utils/supplierCatalogConfig.js'

export default defineEventHandler(async (event) => {
  requireAdmin(event)
  event.node.req.setTimeout?.(320000)

  const db = useDb()
  const summary = await syncAllSheets(db)

  let message = `Sync selesai: ${summary.sheets} tab, ${summary.created} baru, ${summary.updated} diperbarui, ${summary.removed} dihapus.`
  if (summary.failed.length) {
    message += ` Gagal: ${summary.failed.join('; ')}`
  }
  if (summary.sheets === 0 && summary.failed.length) {
    message =
      'Sync gagal untuk semua tab. Pastikan SUPPLIER_CATALOG_SPREADSHEET_ID benar. Detail: ' +
      summary.failed.slice(0, 3).join('; ')
    throw createError({ statusCode: 422, statusMessage: message })
  }

  await logAudit(event, {
    action: 'update',
    entity: 'supplier_catalog',
    summary: message
  })

  const { spreadsheetId } = getSupplierCatalogSettings(useRuntimeConfig().supplierCatalog || {})
  return {
    message,
    sheets: summary.sheets,
    created: summary.created,
    updated: summary.updated,
    removed: summary.removed,
    failed: summary.failed,
    supplierName: catalogSupplierName(),
    spreadsheetId,
    lastSyncedAt: await lastCatalogSyncedAt(db)
  }
})
