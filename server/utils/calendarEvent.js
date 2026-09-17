import { parseYmd } from './projectStatus.js'
import { sanitizeText } from './sanitizeText.js'

export const CALENDAR_EVENT_KINDS = ['survey', 'meeting', 'followup', 'other']

export const calendarEventKindLabel = {
  survey: 'Cek lokasi',
  meeting: 'Meeting',
  followup: 'Follow-up',
  other: 'Lainnya'
}

export function normalizeCalendarEventKind(value) {
  const raw = String(value || '').trim()
  return CALENDAR_EVENT_KINDS.includes(raw) ? raw : null
}

export function parseCalendarEventBody(body) {
  const date = parseYmd(body?.date)
  if (!date) throw createError({ statusCode: 400, statusMessage: 'Tanggal wajib diisi' })
  const kind = normalizeCalendarEventKind(body?.kind) || 'survey'
  const title = sanitizeText(body?.title || '')
  if (!title) throw createError({ statusCode: 400, statusMessage: 'Judul wajib diisi' })
  const customerName = sanitizeText(body?.customerName || '') || null
  const notes = sanitizeText(body?.notes || '') || null
  return { date, kind, title, customerName, notes }
}
