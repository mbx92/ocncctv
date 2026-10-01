export function normalizeSheetName(name) {
  return String(name || '')
    .toLowerCase()
    .replace(/\\x26/gi, '&')
    .replace(/&amp;/g, '&')
    .replace(/\\\//g, '/')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function decodeSheetLabel(raw) {
  return String(raw || '')
    .replace(/\\x([0-9a-fA-F]{2})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/\\\//g, '/')
    .replace(/\\"/g, '"')
}

export async function discoverLiveSheets(spreadsheetId) {
  const id = String(spreadsheetId || '').trim()
  if (!id) return []
  const url = `https://docs.google.com/spreadsheets/d/${id}/htmlview`
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0' },
    signal: AbortSignal.timeout(30000)
  })
  if (!res.ok) return []
  const html = await res.text()
  const sheets = []
  const seen = new Set()
  const re = /items\.push\(\{name: "(.*?)", pageUrl:.*?gid: "(-?\d+)"/g
  let match
  while ((match = re.exec(html))) {
    const name = decodeSheetLabel(match[1]).trim()
    const gid = String(match[2] || '').trim()
    if (!name || !gid || seen.has(gid)) continue
    seen.add(gid)
    sheets.push({ name, gid })
  }
  return sheets
}

export function matchLiveSheet(sheet, liveSheets) {
  const live = liveSheets || []
  const gid = String(sheet?.gid || '').trim()
  if (gid && gid !== '0') {
    const byGid = live.find((row) => row.gid === gid)
    if (byGid) return byGid
  }
  const candidates = [sheet?.sheetName, sheet?.label, sheet?.categoryFilter]
    .map(normalizeSheetName)
    .filter(Boolean)
  for (const want of candidates) {
    const exact = live.find((row) => normalizeSheetName(row.name) === want)
    if (exact) return exact
  }
  return null
}

export async function fetchSpreadsheetCsv(spreadsheetId, { gid = '', sheetName = '' } = {}) {
  const id = String(spreadsheetId || '').trim()
  if (!id) return ''
  const url = gid
    ? `https://docs.google.com/spreadsheets/d/${id}/gviz/tq?tqx=out:csv&gid=${encodeURIComponent(gid)}`
    : `https://docs.google.com/spreadsheets/d/${id}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheetName)}`
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0' },
    signal: AbortSignal.timeout(45000)
  })
  if (!res.ok) return ''
  return (await res.text()).trim()
}

export function filterDumpForSheet(dumpItems, sheet) {
  const rows = dumpItems || []
  if (!rows.length) return []
  const wants = [sheet.categoryFilter, sheet.sheetName, sheet.label]
    .map(normalizeSheetName)
    .filter(Boolean)
  if (!wants.length) return []

  const exact = rows.filter((item) => {
    const jenis = normalizeSheetName(item.category)
    const merek = normalizeSheetName(item.merek)
    return wants.includes(jenis) || wants.includes(merek)
  })
  if (exact.length && exact.length <= Math.max(8, Math.floor(rows.length * 0.35))) return exact

  const tokens = normalizeSheetName(sheet.sheetName || sheet.label)
    .split(' ')
    .filter((token) => token.length >= 4)
  if (tokens.length !== 1) return []
  const token = tokens[0]
  const loose = rows.filter((item) => {
    const jenis = normalizeSheetName(item.category)
    const merek = normalizeSheetName(item.merek)
    return jenis === token || merek === token
  })
  if (loose.length && loose.length <= Math.max(8, Math.floor(rows.length * 0.35))) return loose
  return []
}
