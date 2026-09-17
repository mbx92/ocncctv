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
  const userId = event.context.auth?.id
  if (!userId) throw createError({ statusCode: 401, statusMessage: 'Belum login' })
  const userAgent = String(getHeader(event, 'user-agent') || '').slice(0, 240) || null
  const db = useDb()
  const [existing] = await db
    .select({ id: schema.pushSubscriptions.id })
    .from(schema.pushSubscriptions)
    .where(eq(schema.pushSubscriptions.endpoint, endpoint))
    .limit(1)
  if (existing) {
    const [row] = await db
      .update(schema.pushSubscriptions)
      .set({ userId, p256dh, auth, userAgent, updatedAt: new Date() })
      .where(eq(schema.pushSubscriptions.id, existing.id))
      .returning()
    return { ok: true, id: row.id }
  }
  const [row] = await db
    .insert(schema.pushSubscriptions)
    .values({ userId, endpoint, p256dh, auth, userAgent })
    .returning()
  return { ok: true, id: row.id }
})
