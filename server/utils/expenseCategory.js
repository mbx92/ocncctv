import { eq } from 'drizzle-orm'

export const SYSTEM_CATEGORY_COLORS = {
  material: '#0f766e',
  packaging: '#0369a1',
  tool: '#57534e',
  electricity: '#b45309',
  machine: '#475569',
  rnd: '#7e22ce',
  technician: '#047857',
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

function normalizeHex(value) {
  const raw = String(value || '').trim()
  const m = raw.match(/^#?([0-9a-f]{6})$/i)
  return m ? `#${m[1].toLowerCase()}` : ''
}

function hslToHex(h, s, l) {
  const sat = s / 100
  const light = l / 100
  const a = sat * Math.min(light, 1 - light)
  const f = (n) => {
    const k = (n + h / 30) % 12
    const color = light - a * Math.max(Math.min(k - 3, 9 - k, 1), -1)
    return Math.round(255 * color)
      .toString(16)
      .padStart(2, '0')
  }
  return `#${f(0)}${f(8)}${f(4)}`
}

function hueOf(hex) {
  const n = normalizeHex(hex).slice(1)
  if (n.length !== 6) return null
  const r = parseInt(n.slice(0, 2), 16) / 255
  const g = parseInt(n.slice(2, 4), 16) / 255
  const b = parseInt(n.slice(4, 6), 16) / 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const d = max - min
  if (!d) return 0
  let h = 0
  if (max === r) h = ((g - b) / d) % 6
  else if (max === g) h = (b - r) / d + 2
  else h = (r - g) / d + 4
  h *= 60
  if (h < 0) h += 360
  return h
}

export function pickUnusedCategoryColor(usedColors) {
  const used = new Set((usedColors || []).map(normalizeHex).filter(Boolean))
  const free = CATEGORY_COLOR_POOL.filter((c) => !used.has(c))
  if (free.length) return free[Math.floor(Math.random() * free.length)]
  const usedHues = [...used].map(hueOf).filter((h) => h != null)
  for (let i = 0; i < 360; i += 1) {
    const hue = (Math.floor(Math.random() * 360) + i * 17) % 360
    if (usedHues.some((h) => Math.min(Math.abs(h - hue), 360 - Math.abs(h - hue)) < 14)) continue
    return hslToHex(hue, 72, 38)
  }
  return hslToHex(Math.floor(Math.random() * 360), 72, 38)
}

export async function nextCategoryColor(db, schema) {
  const rows = await db.select({ color: schema.expenseCategories.color, key: schema.expenseCategories.key }).from(
    schema.expenseCategories
  )
  const used = rows.map((row) => row.color || SYSTEM_CATEGORY_COLORS[row.key] || '')
  return pickUnusedCategoryColor(used)
}

export function slugifyCategory(name) {
  const base = String(name || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return base || 'kategori'
}

export async function uniqueCategoryKey(db, schema, name) {
  const base = slugifyCategory(name)
  let key = base
  let n = 2
  for (;;) {
    const [row] = await db.select({ id: schema.expenseCategories.id }).from(schema.expenseCategories).where(eq(schema.expenseCategories.key, key))
    if (!row) return key
    key = `${base}-${n}`
    n += 1
  }
}

export async function assertExpenseCategory(db, schema, key) {
  const k = String(key || '').trim()
  if (!k) throw createError({ statusCode: 400, statusMessage: 'Kategori pengeluaran wajib dipilih' })
  const [row] = await db.select().from(schema.expenseCategories).where(eq(schema.expenseCategories.key, k))
  if (!row) throw createError({ statusCode: 400, statusMessage: 'Kategori pengeluaran tidak ditemukan' })
  return row
}
