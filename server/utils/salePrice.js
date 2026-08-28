export function suggestedSalePrice(cost, marginPercent, rounding = 0) {
  const c = Math.max(Math.round(Number(cost) || 0), 0)
  const m = Math.min(Math.max(Number(marginPercent) || 0, 0), 95) / 100
  if (!c) return 0
  const raw = Math.round(c / (1 - m))
  const step = Math.max(Math.round(Number(rounding) || 0), 0)
  if (!step) return raw
  return Math.ceil(raw / step) * step
}
