import { timingSafeEquals } from '../../utils/session.js'
import { dispatchPushReminders } from '../../utils/reminders.js'

function cronSecretOk(event) {
  const secret = String(process.env.CRON_SECRET || '').trim()
  if (!secret) return false
  const header = String(getHeader(event, 'x-cron-secret') || '').trim()
  const bearer = String(getHeader(event, 'authorization') || '')
    .replace(/^Bearer\s+/i, '')
    .trim()
  const query = String(getQuery(event).secret || '').trim()
  return [header, bearer, query].some((given) => given && timingSafeEquals(given, secret))
}

export default defineEventHandler(async (event) => {
  if (!cronSecretOk(event)) {
    throw createError({ statusCode: 401, statusMessage: 'Cron tidak sah' })
  }
  const result = await dispatchPushReminders()
  return { ok: true, ...result }
})
