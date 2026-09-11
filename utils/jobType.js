export const JOB_TYPES = ['install', 'maintenance']

export const jobTypeLabel = {
  install: 'Pasang baru',
  maintenance: 'Maintenance'
}

export const jobTypeBadge = {
  install: 'bg-sky-100 text-sky-800',
  maintenance: 'bg-amber-100 text-amber-800'
}

export function normalizeJobType(value) {
  const raw = String(value || '').trim()
  return JOB_TYPES.includes(raw) ? raw : null
}

export function jobTypeClass(value) {
  return jobTypeBadge[value] || 'bg-ink-100 text-ink-500'
}
