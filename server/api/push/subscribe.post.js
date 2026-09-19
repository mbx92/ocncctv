import { eq } from 'drizzle-orm'
import { useDb, schema } from '../../db/index.js'

export default defineEventHandler(async (event) => {
  const body = (await readBody(event).catch(() => null)) || {}
  const endpoint = String(body.endpoint || '').trim()
  const p256dh = String(body.keys?.p256dh || body.p256dh || '').trim()
  const auth = String(body.keys?.auth || body.auth || '').trim()
  if (!endpoint || !p256dh || !auth) {
    throw createError({ statusCode: 400, statusMessage: 'Langganan push tidak lengkap' })
  }
  const confirm = body.confirm === true
  const userId = event.context.auth?.id
  if (!userId) throw createError({ statusCode: 401, statusMessage: 'Belum login' })
  const userAgent = String(getHeader(event, 'user-agent') || '').slice(0, 240) || null
  const db = useDb()
  const [existing] = await db
    .select({ id: schema.pushSubscriptions.id })
    .from(schema.pushSubscriptions)
    .where(eq(schema.pushSubscriptions.endpoint, endpoint))
    .limit(1)
  let row
  if (existing) {
    ;[row] = await db
      .update(schema.pushSubscriptions)
      .set({ userId, p256dh, auth, userAgent, updatedAt: new Date() })
      .where(eq(schema.pushSubscriptions.id, existing.id))
      .returning()
  } else {
    ;[row] = await db
      .insert(schema.pushSubscriptions)
      .values({ userId, endpoint, p256dh, auth, userAgent })
      .returning()
  }

  const shouldConfirm = confirm || !existing
  if (shouldConfirm) {
    setTimeout(async () => {
      try {
        const { sendPushToSubscription } = await import('../../utils/push.js')
        await sendPushToSubscription(row, {
          title: 'Pengingat OCN aktif',
          body: 'Notifikasi akan muncul meski aplikasi tertutup.',
          url: '/',
          tag: 'ocn-push-ready'
        })
      } catch (e) {
        console.error('[OCN] Push uji langganan gagal:', e.message || e)
      }
    }, 400)
  }

  return { ok: true, id: row.id }
})
