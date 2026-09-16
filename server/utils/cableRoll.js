const EXPLICIT_LENGTHS = new Set([50, 100, 200, 300, 305])

export function isMeterUnit(unit) {
  return /^(m|mtr|meter|metre|meters|metres)$/i.test(String(unit || '').trim())
}

export function isRollUnit(unit) {
  return /^(roll|rol|rolls)$/i.test(String(unit || '').trim())
}

function looksLikeNetworkCable(name, code, unit) {
  const text = `${code || ''} ${name || ''} ${unit || ''}`
  return /roll/i.test(text) || /kabel\s*(lan|rg)|cable\s*(lan|rg)|\butp\b|\bftp\b|rg\s*\d/i.test(text)
}

export function parseMetersPerRoll(item = {}) {
  const stored = Number(item.contentQty ?? item.metersPerRoll ?? item.unitsPerPurchase ?? 0)
  if (Number.isFinite(stored) && stored > 1) return Math.round(stored)

  const name = String(item.name || '')
  const code = String(item.code || '')
  const unit = String(item.unit || '')
  const text = `${code} ${name} ${unit}`
  const isRoll = /roll/i.test(text)
  const isCable = looksLikeNetworkCable(name, code, unit)

  const explicit = text.match(/(\d+)\s*(?:m(?:eter)?s?)\b/i)
  if (explicit) {
    const n = Number(explicit[1])
    if (n >= 20 && n <= 1000) return n
  }

  if (isRoll || isCable) {
    const embedded = text.match(/(?:^|[\s\-\/_])(305|300|200|100|50)(?=$|[\s\-\/_])/)
    if (embedded && EXPLICIT_LENGTHS.has(Number(embedded[1]))) return Number(embedded[1])
  }

  if (isRoll || isCable) {
    if (/rg\s*6\b|rg6|rg\s*59|rg59/i.test(text)) return 300
    return 305
  }
  return null
}

export function pricePerMeter(rollPrice, metersPerRoll) {
  const meters = Math.max(Math.round(Number(metersPerRoll) || 0), 0)
  if (!meters) return Math.max(Math.round(Number(rollPrice) || 0), 0)
  return Math.max(Math.round((Number(rollPrice) || 0) / meters), 0)
}

export function rollsForMeters(meters, metersPerRoll) {
  const need = Math.max(Math.round(Number(meters) || 0), 0)
  const per = Math.max(Math.round(Number(metersPerRoll) || 0), 0)
  if (!per) return need
  if (!need) return 0
  return Math.ceil(need / per)
}

export function metersFromRolls(rolls, metersPerRoll) {
  return Math.max(Math.round(Number(rolls) || 0), 0) * Math.max(Math.round(Number(metersPerRoll) || 1), 1)
}

export function formatRollHint(metersPerRoll) {
  const n = Math.max(Math.round(Number(metersPerRoll) || 0), 0)
  return n > 1 ? `1 roll = ${n} meter` : ''
}

export function cableRollInfo(item = {}) {
  const metersPerRoll = parseMetersPerRoll(item)
  if (!metersPerRoll) return null

  const supplierPrice = Number(item.supplierPrice)
  let rollPrice = 0
  let perMeter = 0
  if (Number.isFinite(supplierPrice) && supplierPrice > 0) {
    rollPrice = Math.round(supplierPrice)
    perMeter = pricePerMeter(rollPrice, metersPerRoll)
  } else if (isMeterUnit(item.unit)) {
    perMeter = Math.max(Math.round(Number(item.costPrice ?? item.pricePerUnit) || 0), 0)
    rollPrice = perMeter * metersPerRoll
  } else {
    rollPrice = Math.max(Math.round(Number(item.costPrice ?? item.pricePerUnit ?? item.rollPrice) || 0), 0)
    perMeter = pricePerMeter(rollPrice, metersPerRoll)
  }

  return {
    metersPerRoll,
    purchaseUnit: String(item.purchaseUnit || 'roll').trim() || 'roll',
    stockUnit: 'meter',
    rollPrice,
    pricePerMeter: perMeter
  }
}

export function packagingRollInfo(packaging, catalogRow = null) {
  if (!packaging && !catalogRow) return null
  const stored = Number(packaging?.unitsPerPurchase || 0)
  if (packaging && stored > 1) {
    const meterPrice = isMeterUnit(packaging.unit)
      ? Math.max(Math.round(Number(packaging.pricePerUnit) || 0), 0)
      : 0
    const fromCatalog = Number(catalogRow?.supplierPrice) || 0
    const rollPrice = fromCatalog > 0 ? fromCatalog : meterPrice > 0 ? meterPrice * stored : Math.max(Math.round(Number(packaging.pricePerUnit) || 0), 0)
    return {
      metersPerRoll: stored,
      purchaseUnit: String(packaging.purchaseUnit || 'roll').trim() || 'roll',
      stockUnit: isMeterUnit(packaging.unit) ? packaging.unit : 'meter',
      rollPrice,
      pricePerMeter: meterPrice || pricePerMeter(rollPrice, stored)
    }
  }
  return cableRollInfo({
    name: packaging?.name || catalogRow?.name,
    code: catalogRow?.code,
    unit: packaging?.unit || catalogRow?.unit,
    supplierPrice: catalogRow?.supplierPrice,
    costPrice: packaging?.pricePerUnit,
    pricePerUnit: packaging?.pricePerUnit,
    contentQty: catalogRow?.contentQty,
    purchaseUnit: packaging?.purchaseUnit
  })
}

export function requiredMeters(quantity, unit, roll) {
  const qty = Math.max(Math.round(Number(quantity) || 0), 0)
  if (!roll) return qty
  if (isMeterUnit(unit)) return qty
  return qty * roll.metersPerRoll
}

export function stockAsMeters(packaging, roll) {
  const stock = Math.max(Math.round(Number(packaging?.stockQuantity) || 0), 0)
  if (!roll || !packaging) return stock
  if (isMeterUnit(packaging.unit)) return stock
  return stock * roll.metersPerRoll
}

export function purchaseStockMultiplier(packaging) {
  const n = Math.max(Math.round(Number(packaging?.unitsPerPurchase) || 0), 0)
  return n > 1 ? n : 1
}
