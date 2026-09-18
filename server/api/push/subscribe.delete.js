import { and, eq } from 'drizzle-orm'
import { useDb, schema } from '../../db/index.js'

export default defineEventHandler(async (event) => {
  const userId = event.context.auth?.id
  if (!userId) throw createError({ statusCode: 401, statusMessage: 'Belum login' })
  const body = (await readBody(event).catch(() => null)) || {}
  const endpoint = String(body.endpoint || '').trim()
  const db = useDb()
  if (endpoint) {
    await db
      .delete(schema.pushSubscriptions)
      .where(and(eq(schema.pushSubscriptions.endpoint, endpoint), eq(schema.pushSubscriptions.userId, userId)))
  } else {
    await db.delete(schema.pushSubscriptions).where(eq(schema.pushSubscriptions.userId, userId))
  }
  return { ok: true }
})
