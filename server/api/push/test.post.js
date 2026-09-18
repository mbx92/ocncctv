import { eq } from 'drizzle-orm'
import { useDb, schema } from '../../db/index.js'

function pushErrorMessage(err) {
  const status = err?.statusCode || err?.status
  const body = typeof err?.body === 'string' ? err.body : err?.body?.message
  return [status && `HTTP ${status}`, body || err?.message || 'gagal mengirim'].filter(Boolean).join(' — ')
}

export default defineEventHandler(async (event) => {
  const userId = event.context.auth?.id
  if (!userId) throw createError({ statusCode: 401, statusMessage: 'Belum login' })

  const body = (await readBody(event).catch(() => null)) || {}
  const endpoint = String(body.endpoint || '').trim()
  const p256dh = String(body.keys?.p256dh || body.p256dh || '').trim()
  const auth = String(body.keys?.auth || body.auth || '').trim()

  const db = useDb()
  let subs = []
  if (endpoint && p256dh && auth) {
    subs = [{ id: null, endpoint, p256dh, auth }]
  } else {
    subs = await db.select().from(schema.pushSubscriptions).where(eq(schema.pushSubscriptions.userId, userId))
  }
  if (!subs.length) {
    return { sent: 0, failed: 0, error: 'Perangkat belum terdaftar untuk push' }
  }

  const { sendPushToSubscription, isGonePushError } = await import('../../utils/push.js')
  const payload = {
    title: 'Uji notifikasi OCN',
    body: 'Kalau ini muncul, pengingat akan jalan meski aplikasi tertutup.',
    url: '/settings?tab=umum',
    tag: 'ocn-push-test'
  }

  let sent = 0
  let failed = 0
  let error = ''
  for (const sub of subs) {
    try {
      await sendPushToSubscription(sub, payload)
      sent += 1
    } catch (err) {
      failed += 1
      error = pushErrorMessage(err)
      if (sub.id && isGonePushError(err)) {
        await db.delete(schema.pushSubscriptions).where(eq(schema.pushSubscriptions.id, sub.id))
      }
    }
  }
  return { sent, failed, error: sent ? '' : error }
})
