export const MATERIAL_UNITS = ['pack', 'pcs', 'roll', 'box', 'meter']

export const MATERIAL_TYPES = [
  { id: 'consumable', label: 'Habis pakai', unit: 'pack' },
  { id: 'part', label: 'Konektor / suku cadang', unit: 'pcs' }
]

const LEGACY_TYPES = [
  { id: 'filament', label: 'Filament', unit: 'gram' },
  { id: 'resin', label: 'Resin', unit: 'ml' }
]

export const STOCK_STATUSES = [
  { id: 'ok', label: 'Ada', hint: 'Masih cukup di gudang / mobil' },
  { id: 'low', label: 'Menipis', hint: 'Perlu beli sebelum proyek berikutnya' },
  { id: 'empty', label: 'Habis', hint: 'Tidak bisa dipakai' }
]

export function materialTypeLabel(type) {
  return (
    MATERIAL_TYPES.find((t) => t.id === type)?.label ||
    LEGACY_TYPES.find((t) => t.id === type)?.label ||
    type ||
    '—'
  )
}

export function materialTypeBadge(type) {
  if (type === 'consumable') return 'bg-teal-500/10 text-teal-700'
  if (type === 'part') return 'bg-ink-100 text-ink-700'
  if (type === 'filament') return 'bg-teal-500/10 text-teal-600'
  if (type === 'resin') return 'bg-accent-100 text-accent-700'
  return 'bg-ink-100 text-ink-700'
}

export function stockStatusLabel(status) {
  return STOCK_STATUSES.find((s) => s.id === status)?.label || 'Ada'
}

export function stockStatusBadge(status) {
  if (status === 'empty') return 'bg-red-100 text-red-700'
  if (status === 'low') return 'bg-amber-100 text-amber-800'
  return 'bg-teal-500/10 text-teal-700'
}

export function materialNeedsRestock(m) {
  return m?.stockStatus === 'low' || m?.stockStatus === 'empty'
}

export function materialTypeOptions(currentType) {
  const options = [...MATERIAL_TYPES]
  const legacy = LEGACY_TYPES.find((t) => t.id === currentType)
  if (legacy && !options.some((t) => t.id === legacy.id)) options.push(legacy)
  return options
}
