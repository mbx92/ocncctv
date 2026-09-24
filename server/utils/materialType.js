const TYPES = ['filament', 'resin', 'part', 'consumable']
const STATUSES = ['ok', 'low', 'empty']

export function parseMaterialType(value, fallback = 'consumable') {
  return TYPES.includes(value) ? value : fallback
}

export function parseStockStatus(value, fallback = 'ok') {
  return STATUSES.includes(value) ? value : fallback
}

export function parseLowStockQuantity(value, fallback = 2) {
  const n = Number(value)
  if (!Number.isFinite(n) || n < 0) return fallback
  return Math.max(Math.round(n), 0)
}

export function parseUnitsPerPurchase(value) {
  const n = Math.round(Number(value) || 0)
  return n > 1 ? n : 1
}

export function parsePurchaseUnit(value, unitsPerPurchase = 1) {
  const unit = String(value || '').trim()
  if (unit) return unit
  return unitsPerPurchase > 1 ? 'pack' : null
}

export function parseMaterialStockQuantity(value, fallback = 0) {
  const n = Number(value)
  if (!Number.isFinite(n) || n < 0) return fallback
  return Math.max(Math.round(n), 0)
}

export function stockStatusFromQuantity(qty, lowAt = 2) {
  const n = Number(qty) || 0
  const threshold = parseLowStockQuantity(lowAt, 2)
  if (n <= 0) return 'empty'
  if (n <= threshold) return 'low'
  return 'ok'
}
