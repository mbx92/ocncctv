function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  const output = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i)
  return output
}

function shownKey(tag, day) {
  return `ocn-reminder:${tag}:${day}`
}

export function useReminders() {
  const supported = computed(() => import.meta.client && typeof window !== 'undefined' && 'Notification' in window)
  const permission = useState('reminderPermission', () => 'default')
  const busy = useState('reminderBusy', () => false)
  const lastError = useState('reminderError', () => '')
  const items = useState('reminderItems', () => [])
  const today = useState('reminderToday', () => '')

  const granted = computed(() => permission.value === 'granted')
  const blocked = computed(() => permission.value === 'denied')
  const secure = computed(() => import.meta.client && typeof window !== 'undefined' && window.isSecureContext)

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
      const reg = await Promise.race([
        navigator.serviceWorker?.ready || Promise.resolve(null),
        new Promise((resolve) => setTimeout(() => resolve(null), 2500))
      ])
      if (reg?.showNotification) await reg.showNotification(item.title, opts)
      else new Notification(item.title, opts)
      localStorage.setItem(key, '1')
      return true
    } catch {
      return false
    }
  }

  async function notifyLocal() {
    if (!granted.value) return 0
    const list = await refreshItems()
    let shown = 0
    for (const item of list) {
      if (await showLocal(item)) shown += 1
    }
    return shown
  }

  async function subscribePush() {
    if (!granted.value || !navigator.serviceWorker) return false
    const reg = await Promise.race([
      navigator.serviceWorker.ready,
      new Promise((resolve) => setTimeout(() => resolve(null), 2500))
    ])
    if (!reg?.pushManager) return false
    const vapid = await $fetch('/api/push/vapid')
    let sub = await reg.pushManager.getSubscription()
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapid.publicKey)
      })
    }
    await $fetch('/api/push/subscribe', { method: 'POST', body: sub.toJSON() })
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
        lastError.value = result === 'denied' ? 'Izin notifikasi ditolak.' : 'Izin notifikasi belum diberikan.'
        return false
      }
      try {
        await subscribePush()
      } catch (e) {
        lastError.value = e.data?.statusMessage || 'Notifikasi lokal aktif. Push latar belakang belum tersambung.'
      }
      await notifyLocal()
      return true
    } finally {
      busy.value = false
    }
  }

  function syncPermission() {
    if (supported.value) permission.value = Notification.permission
  }

  return {
    supported,
    secure,
    permission,
    granted,
    blocked,
    busy,
    lastError,
    items,
    today,
    refreshItems,
    notifyLocal,
    subscribePush,
    enable,
    syncPermission
  }
}
