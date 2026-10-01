import { parseMetersPerRoll } from './cableRoll.js'

export function parseCsvToRows(csv) {
  const text = String(csv || '').replace(/^\uFEFF/, '')
  const rows = []
  let row = []
  let field = ''
  let inQuotes = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i++
        } else inQuotes = false
      } else field += c
      continue
    }
    if (c === '"') {
      inQuotes = true
      continue
    }
    if (c === ',') {
      row.push(field)
      field = ''
      continue
    }
    if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++
      row.push(field)
      if (row.some((cell) => String(cell).trim() !== '')) rows.push(row)
      row = []
      field = ''
      continue
    }
    field += c
  }
  if (field.length || row.length) {
    row.push(field)
    if (row.some((cell) => String(cell).trim() !== '')) rows.push(row)
  }
  return rows
}

function containsJenisHeader(normalizedRow) {
  return normalizedRow.some((h) => h.includes('jenis'))
}

function rowHasCatalogHeader(normalizedRow) {
  let hasName = false
  let hasCode = false
  let hasPrice = false
  for (const header of normalizedRow) {
    if (header.includes('nama item')) hasName = true
    if (header.includes('kode item') || header === 'kode') hasCode = true
    if (header === 'harga' || header.includes('harga')) hasPrice = true
  }
  return hasName && hasCode && (hasPrice || normalizedRow.includes('jenis') || containsJenisHeader(normalizedRow))
}

function looksLikePrice(value) {
  if (value == null || value === '') return false
  if (typeof value === 'number' && Number.isFinite(value)) return true
  const text = String(value).trim().toLowerCase()
  if (!text || text === '###') return false
  if (text.startsWith('rp')) return true
  return /^[\d,.-]+$/.test(text)
}

function parseRupiah(value) {
  const text = String(value || '').trim()
  if (!text || text === '###' || text.toLowerCase() === 'rp0') return 0
  const numeric = text.replace(/[^\d,.-]/g, '').replace(/,/g, '')
  const n = Number(numeric)
  return Number.isFinite(n) ? Math.round(n) : 0
}

function cellAmount(row, idx) {
  if (idx == null || idx < 0) return 0
  const raw = row[idx]
  if (typeof raw === 'number' && Number.isFinite(raw)) return Math.round(raw)
  return parseRupiah(raw)
}

function resolveSupplierPrice(row, columnMap, codeIdx) {
  for (const idx of [columnMap.price, columnMap.priceLevel4]) {
    const amount = cellAmount(row, idx)
    if (amount >= 100) return amount
  }
  for (let j = row.length - 1; j > codeIdx; j--) {
    if (j === columnMap.unit || j === columnMap.name || j === columnMap.code || j === columnMap.category) continue
    if (!looksLikePrice(row[j])) continue
    const amount = cellAmount(row, j)
    if (amount >= 100) return amount
  }
  return 0
}

function isInventoryDumpHeader(normalizedRow) {
  const hasLevel = normalizedRow.some((h) => h.startsWith('harga level'))
  const hasCode = normalizedRow.some((h) => h === 'kode item' || h.includes('kode item'))
  return hasLevel && hasCode
}

function parseDataRow(row, columnMap, codeIdx) {
  const code = String(row[codeIdx] ?? '').trim()
  if (!code || code.toLowerCase().includes('kode item')) return null

  let nameIdx = columnMap.name ?? codeIdx + 1
  const headerNameGap = nameIdx - codeIdx
  const neighbor = String(row[codeIdx + 1] ?? '').trim()
  if (headerNameGap > 1 && neighbor && !looksLikePrice(neighbor)) {
    nameIdx = codeIdx + 1
  }

  let name = String(row[nameIdx] ?? '').trim()
  if (!name && neighbor && !looksLikePrice(neighbor)) name = neighbor
  if (!name && columnMap.name != null) name = String(row[columnMap.name] ?? '').trim()
  if (!name) return null

  let category = ''
  if (columnMap.category != null) category = String(row[columnMap.category] ?? '').trim()

  let merek = ''
  if (columnMap.brand != null) merek = String(row[columnMap.brand] ?? '').trim()

  let unit = ''
  if (columnMap.unit != null) unit = String(row[columnMap.unit] ?? '').trim()

  const supplierPrice = resolveSupplierPrice(row, columnMap, codeIdx)

  if (!category) {
    const last = row.length - 1
    for (let j = codeIdx + 1; j <= last; j++) {
      if (j === nameIdx || j === columnMap.name || j === columnMap.unit || j === columnMap.price || j === columnMap.priceLevel4) continue
      const candidate = String(row[j] ?? '').trim()
      if (candidate && !looksLikePrice(candidate) && candidate !== '###') {
        category = candidate
        break
      }
    }
  }

  return { code, name, category, merek, supplierPrice, unit }
}

export function parseSheetRows(rows, sheet, supplierName) {
  let headerIndex = null
  const columnMap = {}

  for (let index = 0; index < rows.length; index++) {
    const normalized = rows[index].map((cell) => String(cell ?? '').trim().toLowerCase())
    if (!rowHasCatalogHeader(normalized)) continue
    headerIndex = index
    normalized.forEach((header, colIndex) => {
      if (!header || header === '0') return
      if (header.includes('kode item') || header === 'kode_item' || header === 'kode') {
        columnMap.code = colIndex
      } else if (header.includes('nama item')) {
        columnMap.name = colIndex
      } else if (header.includes('jenis') && columnMap.category == null) {
        columnMap.category = colIndex
      } else if (header === 'merek' || header === 'brand') {
        columnMap.brand = colIndex
      } else if (header === 'harga') {
        columnMap.price = colIndex
      } else if (header === 'harga level 4') {
        columnMap.priceLevel4 = colIndex
      } else if (header.includes('harga') && !header.includes('pokok') && columnMap.price == null) {
        columnMap.price = colIndex
      } else if (header === 'satuan' || header === 'unit' || header === 'uom') {
        columnMap.unit = colIndex
      } else if (header.includes('satuan') && !header.includes('kode') && columnMap.unit == null) {
        columnMap.unit = colIndex
      }
    })
    break
  }

  if (headerIndex == null) return []

  const headerNormalized = rows[headerIndex].map((cell) => String(cell ?? '').trim().toLowerCase())
  const dump = isInventoryDumpHeader(headerNormalized)
  const categoryFilter = String(sheet.categoryFilter || (dump ? sheet.sheetName : '') || '')
    .trim()
    .toLowerCase()

  const items = []
  const sheetKey = String(sheet.key)
  const sheetLabel = String(sheet.label)
  const codeIdx = columnMap.code ?? 0

  for (let i = headerIndex + 1; i < rows.length; i++) {
    const parsed = parseDataRow(rows[i], columnMap, codeIdx)
    if (!parsed || parsed.code === '') continue
    const category = parsed.category || sheetLabel
    if (categoryFilter && String(category).trim().toLowerCase() !== categoryFilter) continue
    const metersPerRoll = parseMetersPerRoll(parsed)
    const unit = String(parsed.unit || '').trim() || (metersPerRoll ? 'roll' : 'pcs')
    items.push({
      ref: `${sheetKey}:${parsed.code}`,
      code: parsed.code,
      name: parsed.name,
      category,
      merek: parsed.merek || '',
      unit,
      contentQty: metersPerRoll,
      supplierPrice: parsed.supplierPrice,
      sheetKey,
      sheetLabel,
      supplierName
    })
  }
  return items
}

export function parseCsv(csv, sheet, supplierName) {
  return parseSheetRows(parseCsvToRows(csv), sheet, supplierName)
}

export function csvIsInventoryDump(csv) {
  const rows = parseCsvToRows(csv)
  if (!rows.length) return false
  const header = rows[0].map((cell) => String(cell ?? '').trim().toLowerCase())
  return isInventoryDumpHeader(header)
}

export function parseInventoryItems(csv, supplierName) {
  return parseSheetRows(
    parseCsvToRows(csv),
    { key: '_inventory', label: '', sheetName: '', categoryFilter: '' },
    supplierName
  )
}

export function uniqueCategoryCount(items) {
  return new Set((items || []).map((item) => String(item.category || '').trim().toLowerCase()).filter(Boolean)).size
}
