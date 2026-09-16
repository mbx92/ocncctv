const STORAGE_KEY = 'ocn.catalogNoticeSeenAt'
const NOTICE_KEY = 'catalog-notice'
let pollStarted = false

export function useCatalogNotice() {
  const { data, refresh } = useFetch('/api/catalog/notice', {
    key: NOTICE_KEY,
    default: () => null
  })

  const seenAt = useState('catalogNoticeSeenAt', () => {
    if (!import.meta.client) return ''
    try {
      return localStorage.getItem(STORAGE_KEY) || ''
    } catch {
      return ''
    }
  })

  const synced = computed(() => Boolean(data.value?.lastSyncedAt))

  const unread = computed(() => {
    const at = data.value?.lastSyncedAt
    if (!at) return false
    if (!seenAt.value) return true
    const next = new Date(at).getTime()
    const seen = new Date(seenAt.value).getTime()
    if (!Number.isFinite(next)) return false
    if (!Number.isFinite(seen)) return true
    return next > seen
  })

  function markSeen() {
    const at = data.value?.lastSyncedAt
    if (!at) return
    seenAt.value = at
    if (import.meta.client) {
      try {
        localStorage.setItem(STORAGE_KEY, at)
      } catch {
        /* ignore quota / private mode */
      }
    }
  }

  if (import.meta.client && !pollStarted) {
    pollStarted = true
    setInterval(() => {
      refreshNuxtData(NOTICE_KEY)
    }, 5 * 60 * 1000)
  }

  return { notice: data, synced, unread, refresh, markSeen }
}

export function formatCatalogSyncTime(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })
}
