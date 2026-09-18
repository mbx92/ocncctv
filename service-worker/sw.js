import { clientsClaim } from 'workbox-core'
import {
  cleanupOutdatedCaches,
  createHandlerBoundToURL,
  precacheAndRoute
} from 'workbox-precaching'
import { NavigationRoute, registerRoute } from 'workbox-routing'

self.skipWaiting()
clientsClaim()
precacheAndRoute(self.__WB_MANIFEST)
cleanupOutdatedCaches()

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting()
})

try {
  registerRoute(
    new NavigationRoute(createHandlerBoundToURL('/'), {
      denylist: [/^\/api\//, /^\/i\//, /^\/q\//, /^\/p\//, /^\/sw\.js$/]
    })
  )
} catch {
  /* index.html belum ada di precache pada sebagian build */
}

function reminderPayload(event) {
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
  return data
}

self.addEventListener('push', (event) => {
  const data = reminderPayload(event)
  event.waitUntil(
    self.registration.showNotification(data.title || 'OCN', {
      body: data.body || '',
      icon: '/pwa-192x192.png',
      badge: '/pwa-192x192.png',
      tag: data.tag || 'ocn-reminder',
      renotify: true,
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
              /* fokus saja */
            }
          }
          return client.focus()
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(target)
    })()
  )
})
