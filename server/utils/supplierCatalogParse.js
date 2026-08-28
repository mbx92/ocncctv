function parseCsvLine(line) {
  const fields = []
  let field = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (inQuotes) {
      if (c === '"') {
        if (line[i + 1] === '"') {
          field += '"'
          i++
        } else inQuotes = false
      } else field += c
    } else if (c === '"') inQuotes = true
    else if (c === ',') {
      fields.push(field)
      field = ''
    } else field += c
  }
  fields.push(field)
  return fields
}

export function parseCsvToRows(csv) {
  const lines = String(csv || '')
    .trim()
    .split(/\r\n|\n|\r/)
  return lines.map(parseCsvLine)
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
  if (!text) return false
  if (text.startsWith('rp')) return true
  return /^[\d,.-]+$/.test(text)
}

function parseRupiah(value) {
  const text = String(value || '').trim()
  if (!text || text.toLowerCase() === 'rp0') return 0
  const numeric = text.replace(/[^\d,.-]/g, '').replace(/,/g, '')
  const n = Number(numeric)
  return Number.isFinite(n) ? Math.round(n) : 0
}

function parseDataRow(row, columnMap, codeIdx) {
  const code = String(row[codeIdx] ?? '').trim()
  if (!code || code.toLowerCase().includes('kode item')) return null

  let nameIdx = columnMap.name ?? codeIdx + 1
  const headerNameGap = nameIdx - codeIdx
  if (headerNameGap > 1 && row[codeIdx + 1] != null && !looksLikePrice(row[codeIdx + 1])) {
    nameIdx = codeIdx + 1
  }

  let name = String(row[nameIdx] ?? '').trim()
  if (!name && row[codeIdx + 1] != null) name = String(row[codeIdx + 1]).trim()
  if (!name) return null

  let category = ''
  if (columnMap.category != null) category = String(row[columnMap.category] ?? '').trim()

  let unit = ''
  if (columnMap.unit != null) unit = String(row[columnMap.unit] ?? '').trim()

  let priceIdx = columnMap.price
  if (priceIdx == null) {
    for (let j = row.length - 1; j > codeIdx; j--) {
      if (looksLikePrice(row[j])) {
        priceIdx = j
        break
      }
    }
  }

  if (!category && priceIdx != null) {
    for (let j = codeIdx + 1; j < priceIdx; j++) {
      if (j === nameIdx || j === (columnMap.name ?? -1) || j === columnMap.unit) continue
      const candidate = String(row[j] ?? '').trim()
      if (candidate && !looksLikePrice(candidate)) {
        category = candidate
        break
      }
    }
  }

  const priceRaw = priceIdx != null ? row[priceIdx] ?? 0 : 0
  const supplierPrice =
    typeof priceRaw === 'number' && Number.isFinite(priceRaw) ? Math.round(priceRaw) : parseRupiah(priceRaw)

  return { code, name, category, supplierPrice, unit }
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
      } else if (header === 'harga' || header.includes('harga')) {
        columnMap.price = colIndex
      } else if (
        header === 'satuan' ||
        header === 'unit' ||
        header === 'uom' ||
        header.includes('satuan')
      ) {
        columnMap.unit = colIndex
      }
    })
    break
  }

  if (headerIndex == null) return []

  const items = []
  const sheetKey = String(sheet.key)
  const sheetLabel = String(sheet.label)
  const codeIdx = columnMap.code ?? 0

  for (let i = headerIndex + 1; i < rows.length; i++) {
    const parsed = parseDataRow(rows[i], columnMap, codeIdx)
    if (!parsed || parsed.code === '') continue
    items.push({
      ref: `${sheetKey}:${parsed.code}`,
      code: parsed.code,
      name: parsed.name,
      category: parsed.category || sheetLabel,
      unit: String(parsed.unit || '').trim() || 'pcs',
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
