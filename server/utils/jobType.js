export const JOB_TYPES = ['install', 'maintenance']

export function normalizeJobType(value) {
  const raw = String(value || '').trim()
  return JOB_TYPES.includes(raw) ? raw : null
}

export function jobTypeLabelOf(value) {
  const key = normalizeJobType(value)
  if (key === 'install') return 'Pasang baru'
  if (key === 'maintenance') return 'Maintenance'
  return null
}

export function parseJobType(value, { required = false } = {}) {
  const parsed = normalizeJobType(value)
  if (parsed) return parsed
  if (required) {
    throw createError({ statusCode: 400, statusMessage: 'Tipe pekerjaan wajib dipilih' })
  }
  if (value != null && String(value).trim()) {
    throw createError({ statusCode: 400, statusMessage: 'Tipe pekerjaan tidak valid' })
  }
  return null
}
