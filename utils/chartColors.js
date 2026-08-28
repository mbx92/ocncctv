export const chartPalette = {
  revenue: '#0d9488',
  grossProfit: '#0284c7',
  netProfit: '#16a34a',
  netLoss: '#dc2626',
  cogs: '#f87171',
  opex: '#fb923c',
  material: '#14b8a6',
  packaging: '#0ea5e9',
  tool: '#78716c',
  electricity: '#d97706',
  machine: '#64748b',
  rnd: '#9333ea',
  technician: '#059669',
  other: '#94a3b8'
}

const extra = ['#e11d48', '#ea580c', '#65a30d', '#0891b2', '#4f46e5', '#c026d3']

export function categoryChartColor(key, index = 0) {
  if (chartPalette[key]) return chartPalette[key]
  let h = index
  for (const ch of String(key || '')) h = (h + ch.charCodeAt(0)) % extra.length
  return extra[h]
}

export function formatChartAxis(value) {
  const n = Math.abs(Number(value) || 0)
  if (n >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)}M`
  if (n >= 1_000_000) return `${(value / 1_000_000).toFixed(0)}jt`
  if (n >= 1_000) return `${(value / 1_000).toFixed(0)}rb`
  return String(Math.round(value))
}
