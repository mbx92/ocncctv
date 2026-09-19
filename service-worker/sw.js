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

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  const output = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i)
  return output
}

function asApplicationServerKey(value) {
  if (!value) return null
  if (typeof value === 'string') return urlBase64ToUint8Array(value)
  if (value instanceof Uint8Array) return value
  try {
    return new Uint8Array(value)
  } catch {
    return null
  }
}

const VAPID_CACHE = 'ocn-push-meta'
const VAPID_URL = '/__ocn/vapid-public-key'

async function readCachedVapidKey() {
  try {
    const cache = await caches.open(VAPID_CACHE)
    const res = await cache.match(VAPID_URL)
    return res ? await res.text() : ''
  } catch {
    return ''
  }
}

async function showReminder(data, { renotify = true } = {}) {
  await self.registration.showNotification(data.title || 'OCN', {
    body: data.body || '',
    icon: '/pwa-192x192.png',
    badge: '/pwa-192x192.png',
    tag: data.tag || 'ocn-reminder',
    renotify,
    data: { url: data.url || '/' }
  })
}

async function notifyFromApi() {
  const res = await fetch('/api/reminders', { credentials: 'include' })
  if (!res.ok) return
  const data = await res.json()
  for (const item of data.items || []) {
    await showReminder(item, { renotify: false })
  }
}

async function resyncPushSubscription(event) {
  const fromOld = asApplicationServerKey(event?.oldSubscription?.options?.applicationServerKey)
  const fromCache = asApplicationServerKey(await readCachedVapidKey())
  const applicationServerKey = fromOld || fromCache
  if (!applicationServerKey) return
  const sub = await self.registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey
  })
  await fetch('/api/push/subscribe', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...sub.toJSON(), confirm: false })
  })
}

self.addEventListener('push', (event) => {
  const data = reminderPayload(event)
  event.waitUntil(showReminder(data))
})

self.addEventListener('pushsubscriptionchange', (event) => {
  event.waitUntil(resyncPushSubscription(event).catch(() => {}))
})

self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'ocn-reminders') event.waitUntil(notifyFromApi().catch(() => {}))
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
