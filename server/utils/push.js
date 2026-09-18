import { createRequire } from 'node:module'
import { eq } from 'drizzle-orm'
import { useDb, schema } from '../db/index.js'
import { getSettings } from './settings.js'

const webpush = createRequire(import.meta.url)('web-push')

function envVapid() {
  const publicKey = String(process.env.VAPID_PUBLIC_KEY || '').trim()
  const privateKey = String(process.env.VAPID_PRIVATE_KEY || '').trim()
  if (!publicKey || !privateKey) return null
  return { publicKey, privateKey }
}

export async function ensureVapidKeys() {
  const fromEnv = envVapid()
  if (fromEnv) return fromEnv
  const settings = await getSettings()
  if (settings.vapidPublicKey && settings.vapidPrivateKey) {
    return { publicKey: settings.vapidPublicKey, privateKey: settings.vapidPrivateKey }
  }
  const generated = webpush.generateVAPIDKeys()
  const db = useDb()
  await db
    .update(schema.appSettings)
    .set({ vapidPublicKey: generated.publicKey, vapidPrivateKey: generated.privateKey })
    .where(eq(schema.appSettings.id, settings.id))
  return generated
}

export async function sendPushToSubscription(sub, payload) {
  const keys = await ensureVapidKeys()
  webpush.setVapidDetails(
    String(process.env.VAPID_SUBJECT || 'mailto:ocn@localhost').trim() || 'mailto:ocn@localhost',
    keys.publicKey,
    keys.privateKey
  )
  await webpush.sendNotification(
    {
      endpoint: sub.endpoint,
      keys: { p256dh: sub.p256dh, auth: sub.auth }
    },
    JSON.stringify(payload),
    { TTL: 24 * 60 * 60, urgency: 'high' }
  )
}

export function isGonePushError(err) {
  const status = Number(err?.statusCode || err?.status || 0)
  return status === 404 || status === 410
}
