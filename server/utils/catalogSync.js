import { eq } from 'drizzle-orm'
import { createError } from 'h3'
import { useDb, schema } from '../db/index.js'
import { getSettings } from './settings.js'
import { catalogSupplierName, lastCatalogSyncedAt, syncAllSheets } from './supplierCatalog.js'
import { getSupplierCatalogSettings } from './supplierCatalogConfig.js'
import { logAudit } from './audit.js'

let inflight = null

export function isCatalogSyncRunning() {
  return Boolean(inflight)
}

function buildSyncMessage(summary, source) {
  const prefix = source === 'schedule' ? 'Sync otomatis selesai' : 'Sync selesai'
  let message = `${prefix}: ${summary.sheets} tab, ${summary.created} baru, ${summary.updated} diperbarui, ${summary.removed} dihapus.`
  if (summary.failed.length) {
    message += ` Gagal: ${summary.failed.join('; ')}`
  }
  return message
}

export function presentCatalogNotice(row, fallbackSyncedAt = null) {
  const lastSyncedAt = row?.catalogSyncLastAt
    ? new Date(row.catalogSyncLastAt).toISOString()
    : fallbackSyncedAt
  return {
    lastSyncedAt,
    source: row?.catalogSyncLastSource || null,
    message: row?.catalogSyncLastMessage || null,
    created: Number(row?.catalogSyncCreated) || 0,
    updated: Number(row?.catalogSyncUpdated) || 0,
    removed: Number(row?.catalogSyncRemoved) || 0,
    changed:
      (Number(row?.catalogSyncCreated) || 0) +
        (Number(row?.catalogSyncUpdated) || 0) +
        (Number(row?.catalogSyncRemoved) || 0) >
      0
  }
}

export async function getCatalogSyncNotice(db = useDb()) {
  const settings = await getSettings()
  const fallback = settings?.catalogSyncLastAt ? null : await lastCatalogSyncedAt(db)
  return presentCatalogNotice(settings, fallback)
}

export async function saveCatalogSyncNotice(db, { source, summary, message, lastSyncedAt }) {
  const rows = await db.select({ id: schema.appSettings.id }).from(schema.appSettings).limit(1)
  const settings = rows[0]
  if (!settings) return
  await db
    .update(schema.appSettings)
    .set({
      catalogSyncLastAt: lastSyncedAt ? new Date(lastSyncedAt) : new Date(),
      catalogSyncLastSource: source === 'schedule' ? 'schedule' : 'manual',
      catalogSyncLastMessage: message,
      catalogSyncCreated: summary.created || 0,
      catalogSyncUpdated: summary.updated || 0,
      catalogSyncRemoved: summary.removed || 0
    })
    .where(eq(schema.appSettings.id, settings.id))
}

export async function runCatalogSync({ source = 'manual', event = null } = {}) {
  if (inflight) return inflight
  inflight = (async () => {
    const db = useDb()
    const summary = await syncAllSheets(db)
    const message = buildSyncMessage(summary, source)
    if (summary.sheets === 0 && summary.failed.length) {
      const failedMessage =
        'Sync gagal untuk semua tab. Pastikan SUPPLIER_CATALOG_SPREADSHEET_ID benar. Detail: ' +
        summary.failed.slice(0, 3).join('; ')
      throw createError({ statusCode: 422, statusMessage: failedMessage })
    }

    const lastSyncedAt = await lastCatalogSyncedAt(db)
    await saveCatalogSyncNotice(db, { source, summary, message, lastSyncedAt })

    if (event) {
      await logAudit(event, {
        action: 'update',
        entity: 'supplier_catalog',
        summary: message
      })
    } else {
      console.log(`[OCN] Katalog supplier (${source}): ${message}`)
    }

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
      lastSyncedAt,
      source: source === 'schedule' ? 'schedule' : 'manual'
    }
  })().finally(() => {
    inflight = null
  })
  return inflight
}
