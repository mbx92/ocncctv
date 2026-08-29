const BRAND_ALIASES = {
  hikvision: ['hikvision', 'hik'],
  hilook: ['hilook', 'hi-look', 'hi look'],
  tplink: ['tplink', 'tp-link', 'tp link'],
  mikrotik: ['mikrotik', 'microtik'],
  dahua: ['dahua'],
  ezviz: ['ezviz'],
  imou: ['imou'],
  tiandy: ['tiandy'],
  ruijie: ['ruijie'],
  vention: ['vention'],
  mercusys: ['mercusys'],
  huawei: ['huawei'],
  toa: ['toa'],
  takasi: ['takasi'],
  foredge: ['foredge'],
  robot: ['robot']
}

function escapeRe(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function catalogBrandFromLabel(sheetLabel) {
  const token = String(sheetLabel || '').trim().split(/[\s&/,]+/)[0] || ''
  return token.toUpperCase()
}

function aliasesFor(brand) {
  const key = String(brand || '').trim().toLowerCase()
  if (!key) return []
  const extra = BRAND_ALIASES[key] || []
  return [...new Set([key, ...extra])]
}

export function stripCatalogParentheticals(name) {
  return String(name || '')
    .replace(/\s+\([^)]*\)/g, '')
    .replace(/\s+\([^)]*$/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function stripBrandTokens(name, brand) {
  let out = String(name || '')
  for (const alias of aliasesFor(brand)) {
    const re = new RegExp(`(^|\\s)${escapeRe(alias)}(?=\\s|$)`, 'gi')
    out = out.replace(re, '$1')
  }
  return out.replace(/\s+/g, ' ').trim()
}

export function catalogDisplayName(item) {
  const brand = catalogBrandFromLabel(item?.sheetLabel || item?.brand)
  const cleaned = stripCatalogParentheticals(item?.name)
  if (!cleaned) return brand
  if (!brand) return cleaned
  const rest = stripBrandTokens(cleaned, brand)
  return rest ? `${brand} ${rest}` : brand
}

export function catalogItemKey(item) {
  if (item?.id != null) return String(item.id)
  if (item?.ref) return `ref:${item.ref}`
  if (item?.code) return `code:${item.code}`
  return String(item?.name || '')
}
