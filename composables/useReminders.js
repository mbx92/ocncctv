function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  const output = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i)
  return output
}

const PREF_KEY = 'ocn-notifications-enabled'

function shownKey(tag, day) {
  return `ocn-reminder:${tag}:${day}`
}

function readWantedPref() {
  if (!import.meta.client) return false
  const raw = localStorage.getItem(PREF_KEY)
  if (raw === '0') return false
  if (raw === '1') return true
  return typeof Notification !== 'undefined' && Notification.permission === 'granted'
}

async function waitForServiceWorker(timeoutMs = 20000) {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return null
  try {
    const existing = await navigator.serviceWorker.getRegistration()
    if (!existing) await navigator.serviceWorker.register('/sw.js', { scope: '/' })
  } catch {
    /* vite-pwa biasanya sudah mendaftarkan */
  }
  return Promise.race([
    navigator.serviceWorker.ready.catch(() => null),
    new Promise((resolve) => setTimeout(() => resolve(null), timeoutMs))
  ])
}

export function useReminders() {
  const supported = computed(() => import.meta.client && typeof window !== 'undefined' && 'Notification' in window)
  const permission = useState('reminderPermission', () => 'default')
  const busy = useState('reminderBusy', () => false)
  const lastError = useState('reminderError', () => '')
  const items = useState('reminderItems', () => [])
  const today = useState('reminderToday', () => '')
  const wanted = useState('reminderWanted', () => false)

  const granted = computed(() => permission.value === 'granted')
  const blocked = computed(() => permission.value === 'denied')
  const active = computed(() => wanted.value && granted.value)
  const secure = computed(() => import.meta.client && typeof window !== 'undefined' && window.isSecureContext)

  function persistWanted(value) {
    wanted.value = value
    if (import.meta.client) localStorage.setItem(PREF_KEY, value ? '1' : '0')
  }

  async function refreshItems() {
    const res = await $fetch('/api/reminders')
    items.value = res.items || []
    today.value = res.today || todayStr()
    return items.value
  }

  async function showLocal(item) {
    if (!supported.value || Notification.permission !== 'granted') return false
    const day = item.day || today.value || todayStr()
    const key = shownKey(item.tag, day)
    if (localStorage.getItem(key) === '1') return false
    const opts = {
      body: item.body,
      tag: item.tag,
      icon: '/pwa-192x192.png',
      badge: '/pwa-192x192.png',
      data: { url: item.url || '/' },
      renotify: false
    }
    try {
      const reg = await waitForServiceWorker(4000)
      if (reg?.showNotification) await reg.showNotification(item.title, opts)
      else new Notification(item.title, opts)
      localStorage.setItem(key, '1')
      return true
    } catch {
      return false
    }
  }

  async function notifyLocal() {
    if (!active.value) return 0
    const list = await refreshItems()
    let shown = 0
    for (const item of list) {
      if (await showLocal(item)) shown += 1
    }
    return shown
  }

  async function subscribePush(options = {}) {
    if (!wanted.value) return false
    if (!granted.value || !navigator.serviceWorker) {
      throw new Error('Service worker tidak tersedia. Pasang OCN sebagai aplikasi (PWA) lalu buka lagi.')
    }
    const reg = await waitForServiceWorker(20000)
    if (!reg?.pushManager) {
      throw new Error('Service worker belum siap. Tutup aplikasi, buka lagi, lalu aktifkan notifikasi.')
    }
    const vapid = await $fetch('/api/push/vapid')
    if (!vapid?.publicKey) throw new Error('Kunci push server belum tersedia.')
    try {
      const cache = await caches.open('ocn-push-meta')
      await cache.put('/__ocn/vapid-public-key', new Response(vapid.publicKey, { headers: { 'content-type': 'text/plain' } }))
    } catch {
      /* Cache API opsional */
    }
    let sub = await reg.pushManager.getSubscription()
    if (sub) {
      const currentKey = sub.options?.applicationServerKey
      if (currentKey) {
        const same = btoa(String.fromCharCode(...new Uint8Array(currentKey)))
          .replace(/\+/g, '-')
          .replace(/\//g, '_')
          .replace(/=+$/, '')
        if (same !== vapid.publicKey) {
          await sub.unsubscribe()
          sub = null
        }
      }
    }
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapid.publicKey)
      })
    }
    await $fetch('/api/push/subscribe', {
      method: 'POST',
      body: { ...sub.toJSON(), confirm: Boolean(options.confirm) }
    })
    if (reg.periodicSync?.register) {
      try {
        await reg.periodicSync.register('ocn-reminders', { minInterval: 6 * 60 * 60 * 1000 })
      } catch {
        /* Chrome/Android PWA saja */
      }
    }
    return true
  }

  async function enable() {
    lastError.value = ''
    if (!supported.value) {
      lastError.value = 'Browser ini tidak mendukung notifikasi.'
      return false
    }
    if (!window.isSecureContext) {
      lastError.value = 'Notifikasi hanya jalan di localhost atau HTTPS. Buka http://localhost:3000, bukan IP LAN.'
      return false
    }
    busy.value = true
    try {
      const result = await Notification.requestPermission()
      permission.value = result
      if (result !== 'granted') {
        persistWanted(false)
        lastError.value = result === 'denied' ? 'Izin notifikasi ditolak.' : 'Izin notifikasi belum diberikan.'
        return false
      }
      persistWanted(true)
      try {
        await subscribePush({ confirm: true })
      } catch (e) {
        lastError.value =
          e?.data?.statusMessage ||
          e?.message ||
          'Notifikasi lokal aktif. Push latar belakang belum tersambung — buka ulang aplikasi.'
      }
      await notifyLocal()
      return true
    } finally {
      busy.value = false
    }
  }

  async function disable() {
    lastError.value = ''
    persistWanted(false)
    busy.value = true
    try {
      try {
        await $fetch('/api/push/subscribe', { method: 'DELETE', body: {} })
      } catch {
        /* hapus langganan di perangkat tetap dijalankan */
      }
      const reg = await waitForServiceWorker(4000)
      const sub = await reg?.pushManager?.getSubscription()
      if (sub) await sub.unsubscribe()
      return true
    } catch (e) {
      lastError.value = e?.data?.statusMessage || e?.message || 'Gagal mematikan notifikasi.'
      return false
    } finally {
      busy.value = false
    }
  }

  async function testNotification() {
    lastError.value = ''
    if (!active.value) {
      lastError.value = 'Aktifkan notifikasi dulu.'
      return { ok: false, via: null }
    }
    busy.value = true
    try {
      let subJson = null
      try {
        await subscribePush({ confirm: false })
        const reg = await waitForServiceWorker(20000)
        const sub = await reg?.pushManager?.getSubscription()
        subJson = sub?.toJSON?.() || null
      } catch (e) {
        if (window.isSecureContext && navigator.serviceWorker) {
          lastError.value =
            e?.data?.statusMessage ||
            e?.message ||
            'Gagal mendaftar push. Buka ulang aplikasi, lalu uji lagi.'
          return { ok: false, via: null }
        }
      }

      const res = await $fetch('/api/push/test', {
        method: 'POST',
        body: subJson || {}
      })
      if (res?.sent > 0) return { ok: true, via: 'push', sent: res.sent }

      if (window.isSecureContext && navigator.serviceWorker) {
        lastError.value =
          res?.error || 'Push tidak terkirim. Matikan lalu nyalakan notifikasi, kemudian uji lagi.'
        return { ok: false, via: null, sent: 0, failed: res?.failed || 0 }
      }

      const title = 'Uji notifikasi OCN'
      const opts = {
        body: 'Kalau ini muncul, izin di perangkat ini sudah jalan. Push latar belakang butuh HTTPS dan aplikasi terpasang.',
        tag: 'ocn-push-test',
        icon: '/pwa-192x192.png',
        badge: '/pwa-192x192.png',
        renotify: true,
        data: { url: '/settings?tab=umum' }
      }
      const reg = await waitForServiceWorker(4000)
      if (reg?.showNotification) await reg.showNotification(title, opts)
      else new Notification(title, opts)
      return { ok: true, via: 'local', sent: 1 }
    } catch (e) {
      lastError.value = e?.data?.statusMessage || e?.data?.error || e?.message || 'Gagal mengirim notifikasi uji.'
      return { ok: false, via: null }
    } finally {
      busy.value = false
    }
  }

  function syncPermission() {
    if (supported.value) permission.value = Notification.permission
    wanted.value = readWantedPref()
  }

  return {
    supported,
    secure,
    permission,
    granted,
    blocked,
    active,
    wanted,
    busy,
    lastError,
    items,
    today,
    refreshItems,
    notifyLocal,
    subscribePush,
    enable,
    disable,
    testNotification,
    syncPermission
  }
}
