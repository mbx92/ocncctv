export const SYSTEM_CATEGORY_COLORS = {
  material: '#0f766e',
  packaging: '#0369a1',
  tool: '#57534e',
  electricity: '#b45309',
  machine: '#475569',
  rnd: '#7e22ce',
  technician: '#047857',
  pribadi: '#be123c',
  other: '#64748b'
}

export const CATEGORY_COLOR_POOL = [
  '#0f766e',
  '#0369a1',
  '#57534e',
  '#b45309',
  '#475569',
  '#7e22ce',
  '#047857',
  '#64748b',
  '#be123c',
  '#c2410c',
  '#a16207',
  '#4d7c0f',
  '#0e7490',
  '#1d4ed8',
  '#4338ca',
  '#a21caf',
  '#be185d',
  '#b91c1c',
  '#ea580c',
  '#ca8a04',
  '#16a34a',
  '#0284c7',
  '#4f46e5',
  '#c026d3',
  '#db2777',
  '#65a30d',
  '#0891b2',
  '#7c3aed',
  '#e11d48',
  '#9a3412',
  '#155e75',
  '#1e3a8a',
  '#6b21a8',
  '#9d174d',
  '#854d0e',
  '#365314',
  '#164e63',
  '#1e40af',
  '#86198f',
  '#9f1239'
]

export function normalizeCategoryHex(value) {
  const raw = String(value || '').trim()
  const m = raw.match(/^#?([0-9a-f]{6})$/i)
  return m ? `#${m[1].toLowerCase()}` : ''
}

export function categoryHexOf(key, color) {
  return normalizeCategoryHex(color) || SYSTEM_CATEGORY_COLORS[key] || ''
}

function hexRgb(hex) {
  const n = normalizeCategoryHex(hex).slice(1)
  if (n.length !== 6) return null
  return [parseInt(n.slice(0, 2), 16), parseInt(n.slice(2, 4), 16), parseInt(n.slice(4, 6), 16)]
}

export function categoryBadgeStyle(color) {
  const rgb = hexRgb(color)
  if (!rgb) return {}
  return {
    backgroundColor: `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, 0.14)`,
    color: normalizeCategoryHex(color)
  }
}

export function categoryBadgeClass(key, color) {
  if (categoryHexOf(key, color)) return ''
  const known = {
    material: 'bg-teal-500/10 text-teal-600',
    packaging: 'bg-sky-500/10 text-sky-700',
    tool: 'bg-ink-200 text-ink-600',
    electricity: 'bg-amber-100 text-amber-700',
    machine: 'bg-slate-200 text-slate-700',
    rnd: 'bg-purple-100 text-purple-700',
    technician: 'bg-emerald-100 text-emerald-800',
    pribadi: 'bg-rose-100 text-rose-700',
    other: 'bg-ink-100 text-ink-500'
  }
  if (known[key]) return known[key]
  const palette = [
    'bg-rose-100 text-rose-700',
    'bg-orange-100 text-orange-700',
    'bg-lime-100 text-lime-800',
    'bg-cyan-100 text-cyan-800',
    'bg-indigo-100 text-indigo-700',
    'bg-fuchsia-100 text-fuchsia-700'
  ]
  let h = 0
  for (const ch of String(key || '')) h = (h + ch.charCodeAt(0)) % palette.length
  return palette[h]
}

export function categoryBadgeProps(key, color) {
  const hex = categoryHexOf(key, color)
  return {
    class: ['badge', categoryBadgeClass(key, color)].filter(Boolean),
    style: categoryBadgeStyle(hex)
  }
}

export function categoryNameOf(categories, key) {
  return (categories || []).find((c) => c.key === key)?.name || key || '—'
}

export function categoryColorFromList(categories, key) {
  return (categories || []).find((c) => c.key === key)?.color || ''
}
