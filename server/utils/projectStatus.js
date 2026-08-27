export function normalizeProductStatus(status) {
  if (status === 'in_progress' || status === 'active') return 'in_progress'
  if (status === 'done' || status === 'discontinued') return 'done'
  return 'waiting'
}

export function parseYmd(value) {
  const m = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})/)
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null
}
