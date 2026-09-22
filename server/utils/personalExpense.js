export const OWNER_TECHNICIAN_NAME = 'pande'

export function isPersonalCategory(category) {
  const key = String(category?.key || category || '')
    .trim()
    .toLowerCase()
  const name = String(category?.name || '')
    .trim()
    .toLowerCase()
  return key === 'pribadi' || key.startsWith('pribadi-') || name.includes('pribadi')
}

export function isOwnerTechnicianName(name) {
  const n = String(name || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
  return n === OWNER_TECHNICIAN_NAME || n.startsWith(`${OWNER_TECHNICIAN_NAME} `)
}

export function personalCapitalShortfall(amount, remaining) {
  const value = Math.max(Math.round(Number(amount) || 0), 0)
  const available = Math.max(Math.round(Number(remaining) || 0), 0)
  return Math.max(value - available, 0)
}
