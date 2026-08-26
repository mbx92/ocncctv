export const MATERIAL_TYPES = [
  { id: 'filament', label: 'Filament', unit: 'gram' },
  { id: 'resin', label: 'Resin', unit: 'ml' },
  { id: 'part', label: 'Komponen', unit: 'pcs' }
]

export function materialTypeLabel(type) {
  return MATERIAL_TYPES.find((t) => t.id === type)?.label || type || '—'
}

export function materialTypeBadge(type) {
  if (type === 'filament') return 'bg-teal-500/10 text-teal-600'
  if (type === 'resin') return 'bg-accent-100 text-accent-700'
  return 'bg-ink-100 text-ink-700'
}

export function materialLowStock(m) {
  const n = Number(m?.stockQuantity) || 0
  if (m?.type === 'part') return n < 10
  return n < 200
}
