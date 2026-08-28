export const RAB_STATUSES = ['draft', 'sent', 'deal', 'lost']

export const rabStatusLabel = {
  draft: 'Draft',
  sent: 'Dikirim',
  deal: 'Deal',
  lost: 'Tidak deal',
  open: 'Draft',
  ready: 'Dikirim',
  delivered: 'Deal',
  cancelled: 'Tidak deal'
}

export const rabStatusBadge = {
  draft: 'bg-amber-100 text-amber-800',
  sent: 'bg-sky-100 text-sky-800',
  deal: 'bg-green-100 text-green-700',
  lost: 'bg-ink-100 text-ink-400',
  open: 'bg-amber-100 text-amber-800',
  ready: 'bg-sky-100 text-sky-800',
  delivered: 'bg-green-100 text-green-700',
  cancelled: 'bg-ink-100 text-ink-400'
}

export function rabIsLocked(status) {
  return status === 'deal' || status === 'lost' || status === 'delivered' || status === 'cancelled'
}

export const SERVICE_UNITS = ['titik', 'jam', 'paket', 'meter', 'ls']

export function rabLineTypeLabel(lineType) {
  if (lineType === 'service') return 'Jasa'
  if (lineType === 'product') return 'Stok'
  return 'Barang'
}

export function rabLineTypeBadge(lineType) {
  if (lineType === 'service') return 'bg-purple-100 text-purple-700'
  if (lineType === 'product') return 'bg-emerald-100 text-emerald-800'
  return 'bg-sky-100 text-sky-800'
}

export function lineAmount(line) {
  return Math.round((Number(line.quantity) || 0) * (Number(line.salePrice) || 0))
}

export function lineCost(line) {
  return Math.round((Number(line.quantity) || 0) * (Number(line.costPrice) || 0))
}

export function catalogLines(lines) {
  return (lines || []).filter((line) => line.lineType !== 'service')
}

export function serviceLines(lines) {
  return (lines || []).filter((line) => line.lineType === 'service')
}

export function applyRabAdjustments(lines, adjustments) {
  const map = new Map(
    (adjustments || []).map((row) => [Number(row.customOrderLineId), Number(row.quantity)])
  )
  return (lines || []).map((line) => {
    const originalQuantity = Number(line.originalQuantity ?? line.quantity) || 0
    const id = Number(line.id)
    const quantity = map.has(id)
      ? Math.min(Math.max(Math.round(map.get(id) || 0), 0), originalQuantity)
      : originalQuantity
    return {
      ...line,
      originalQuantity,
      quantity,
      reduced: quantity < originalQuantity,
      omitted: quantity <= 0
    }
  })
}

export function summarizeProjectRevenue(lines, wages) {
  let goodsSale = 0
  let goodsCost = 0
  let serviceSale = 0
  for (const line of lines || []) {
    const sale = lineAmount(line)
    const cost = lineCost(line)
    if (line.lineType === 'service') serviceSale += sale
    else {
      goodsSale += sale
      goodsCost += cost
    }
  }
  const wageTotal = (wages || []).reduce((sum, row) => sum + Math.max(Math.round(Number(row.amount) || 0), 0), 0)
  const revenue = goodsSale + serviceSale
  return {
    goodsSale,
    goodsCost,
    serviceSale,
    revenue,
    wageTotal,
    profit: revenue - goodsCost - wageTotal
  }
}

export function suggestedSalePrice(cost, marginPercent, rounding = 0) {
  const c = Math.max(Math.round(Number(cost) || 0), 0)
  const m = Math.min(Math.max(Number(marginPercent) || 0, 0), 95) / 100
  if (!c) return 0
  const raw = Math.round(c / (1 - m))
  const step = Math.max(Math.round(Number(rounding) || 0), 0)
  if (!step) return raw
  return Math.ceil(raw / step) * step
}

export const PRICE_ROUNDING_STEPS = [0, 100, 500, 1000, 5000]
