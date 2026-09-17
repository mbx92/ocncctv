import { eq } from 'drizzle-orm'
import { useDb, schema } from '../../db/index.js'

export default defineEventHandler(async (event) => {
  const body = (await readBody(event).catch(() => null)) || {}
  const endpoint = String(body.endpoint || '').trim()
  if (!endpoint) throw createError({ statusCode: 400, statusMessage: 'Endpoint wajib' })
  const db = useDb()
  await db.delete(schema.pushSubscriptions).where(eq(schema.pushSubscriptions.endpoint, endpoint))
  return { ok: true }
})
