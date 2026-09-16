import { getCatalogSyncNotice, runCatalogSync } from '../utils/catalogSync.js'

const TIME_ZONE = 'Asia/Jakarta'
const SYNC_HOUR = 6
const SYNC_MINUTE = 0
const CATCH_UP_AFTER_MS = 20_000
const STALE_AFTER_MS = 20 * 60 * 60 * 1000

function jakartaParts(date = new Date()) {
  const fmt = new Intl.DateTimeFormat('en-GB', {
    timeZone: TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23'
  })
  const parts = Object.fromEntries(fmt.formatToParts(date).map((p) => [p.type, p.value]))
  return {
    dayKey: `${parts.year}-${parts.month}-${parts.day}`,
    hour: Number(parts.hour),
    minute: Number(parts.minute)
  }
}

async function syncQuietly(reason) {
  try {
    const result = await runCatalogSync({ source: 'schedule' })
    console.log(`[OCN] Sync katalog terjadwal (${reason}): ${result.message}`)
  } catch (e) {
    console.error(`[OCN] Sync katalog terjadwal gagal (${reason}):`, e.statusMessage || e.message || e)
  }
}

export default defineNitroPlugin(() => {
  if (process.env.NUXT_CATALOG_SYNC_DISABLE === '1') {
    console.log('[OCN] Jadwal sync katalog dinonaktifkan (NUXT_CATALOG_SYNC_DISABLE=1)')
    return
  }

  let lastRunDay = ''
  setInterval(() => {
    const { dayKey, hour, minute } = jakartaParts()
    if (hour !== SYNC_HOUR || minute !== SYNC_MINUTE) return
    if (lastRunDay === dayKey) return
    lastRunDay = dayKey
    syncQuietly('06:00 WIB')
  }, 30_000)

  setTimeout(async () => {
    if (import.meta.dev) return
    try {
      const notice = await getCatalogSyncNotice()
      const last = notice.lastSyncedAt ? new Date(notice.lastSyncedAt).getTime() : 0
      if (!Number.isFinite(last) || Date.now() - last >= STALE_AFTER_MS) {
        await syncQuietly('catch-up')
      }
    } catch (e) {
      console.error('[OCN] Cek catch-up sync katalog gagal:', e.message || e)
    }
  }, CATCH_UP_AFTER_MS)
})
