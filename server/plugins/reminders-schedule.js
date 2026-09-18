import { dispatchPushReminders } from '../utils/reminders.js'

const TIME_ZONE = 'Asia/Jakarta'
const DISPATCH_HOUR = 7

function jakartaParts(date = new Date()) {
  const fmt = new Intl.DateTimeFormat('en-GB', {
    timeZone: TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23'
  })
  const parts = Object.fromEntries(fmt.formatToParts(date).map((p) => [p.type, p.value]))
  return {
    dayKey: `${parts.year}-${parts.month}-${parts.day}`,
    hour: Number(parts.hour),
    minute: Number(parts.minute)
  }
}

async function dispatchQuietly(reason) {
  try {
    const result = await dispatchPushReminders()
    console.log(
      `[OCN] Push pengingat (${reason}): terkirim ${result.sent || 0}, dilewati ${result.skipped || 0}, gagal ${result.failed || 0}`
    )
  } catch (e) {
    console.error(`[OCN] Push pengingat gagal (${reason}):`, e.statusMessage || e.message || e)
  }
}

export default defineNitroPlugin(() => {
  if (process.env.NUXT_REMINDERS_DISABLE === '1') {
    console.log('[OCN] Jadwal push pengingat dinonaktifkan (NUXT_REMINDERS_DISABLE=1)')
    return
  }
  if (import.meta.dev) {
    console.log('[OCN] Jadwal push pengingat dilewati di development')
    return
  }

  let lastMorningDay = ''
  setInterval(() => {
    const { dayKey, hour, minute } = jakartaParts()
    if (hour !== DISPATCH_HOUR || minute !== 0) return
    if (lastMorningDay === dayKey) return
    lastMorningDay = dayKey
    dispatchQuietly('07:00 WIB')
  }, 30_000)

  setInterval(() => {
    const { hour } = jakartaParts()
    if (hour < DISPATCH_HOUR) return
    dispatchQuietly('berkala')
  }, 30 * 60 * 1000)

  setTimeout(() => {
    if (import.meta.dev) return
    const { hour } = jakartaParts()
    if (hour < DISPATCH_HOUR) return
    dispatchQuietly('catch-up')
  }, 20_000)
})
