/* Pengingat PWA: push dari server + klik notifikasi. Di-import oleh service worker Workbox. */

self.addEventListener('push', (event) => {
  let data = { title: 'OCN', body: 'Ada pengingat baru.', url: '/', tag: 'ocn-reminder' }
  try {
    if (event.data) data = { ...data, ...event.data.json() }
  } catch {
    try {
      const text = event.data?.text?.()
      if (text) data.body = text
    } catch {
      /* payload opsional */
    }
  }
  event.waitUntil(
    self.registration.showNotification(data.title || 'OCN', {
      body: data.body || '',
      icon: '/pwa-192x192.png',
      badge: '/pwa-192x192.png',
      tag: data.tag || 'ocn-reminder',
      renotify: false,
      data: { url: data.url || '/' }
    })
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const target = event.notification.data?.url || '/'
  event.waitUntil(
    (async () => {
      const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      for (const client of all) {
        if ('focus' in client) {
          if ('navigate' in client) {
            try {
              await client.navigate(target)
            } catch {
              /* biarkan fokus saja */
            }
          }
          return client.focus()
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(target)
    })()
  )
})

async function notifyFromApi() {
  const res = await fetch('/api/reminders', { credentials: 'include' })
  if (!res.ok) return
  const data = await res.json()
  for (const item of data.items || []) {
    await self.registration.showNotification(item.title, {
      body: item.body,
      icon: '/pwa-192x192.png',
      badge: '/pwa-192x192.png',
      tag: item.tag,
      renotify: false,
      data: { url: item.url || '/' }
    })
  }
}

self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'ocn-reminders') event.waitUntil(notifyFromApi())
})
