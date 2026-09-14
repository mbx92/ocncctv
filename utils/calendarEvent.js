export const CALENDAR_EVENT_KINDS = ['survey', 'meeting', 'followup', 'other']

export const calendarEventKindLabel = {
  survey: 'Cek lokasi',
  meeting: 'Meeting',
  followup: 'Follow-up',
  other: 'Lainnya'
}

export function normalizeCalendarEventKind(value) {
  const raw = String(value || '').trim()
  return CALENDAR_EVENT_KINDS.includes(raw) ? raw : 'survey'
}

export function calendarEventKindClass(kind) {
  const key = normalizeCalendarEventKind(kind)
  if (key === 'meeting') return 'bg-sky-100 text-sky-800'
  if (key === 'followup') return 'bg-violet-100 text-violet-800'
  if (key === 'other') return 'bg-ink-200 text-ink-700'
  return 'bg-orange-100 text-orange-800'
}

export function calendarEventKindDot(kind) {
  const key = normalizeCalendarEventKind(kind)
  if (key === 'meeting') return 'bg-sky-500'
  if (key === 'followup') return 'bg-violet-500'
  if (key === 'other') return 'bg-ink-500'
  return 'bg-orange-500'
}
