import { useDb, schema } from '../db/index.js'

// Ambil baris settings tunggal, buat dengan default kalau belum ada.
export async function getSettings() {
  const db = useDb()
  const rows = await db.select().from(schema.appSettings).limit(1)
  if (rows.length) return rows[0]
  const inserted = await db.insert(schema.appSettings).values({}).returning()
  return inserted[0]
}

export function presentSettings(row) {
  const key = String(row?.erpSyncApiKey || '').trim()
  const { erpSyncApiKey, ...rest } = row || {}
  return {
    ...rest,
    erpSyncApiKeySet: !!key,
    erpSyncApiKeyHint: key ? `••••${key.slice(-4)}` : null
  }
}

export function erpSyncConfig(settings, runtime = {}) {
  const baseUrl = String(settings?.erpSyncBaseUrl || runtime.baseUrl || '').trim().replace(/\/+$/, '')
  const apiKey = String(settings?.erpSyncApiKey || runtime.apiKey || '').trim()
  return { baseUrl, apiKey }
}
