import { suggestedSalePrice } from './salePrice.js'

export const CONSUMABLE_LOT_NAME = 'Consumable & Material'
export const CONSUMABLE_LOT_UNIT = 'Lot'
export const CONSUMABLE_LOT_SALE_DEFAULT = 50000
export const CONSUMABLE_LOT_SALE_PRESETS = [
  { id: 50000, label: '50 rb' },
  { id: 100000, label: '100 rb' },
  { id: 150000, label: '150 rb' }
]

export function parseConsumableLotSale(value, fallback = CONSUMABLE_LOT_SALE_DEFAULT) {
  if (value == null || value === '') return fallback
  return Math.max(Math.round(Number(value) || 0), 0)
}

export function consumableLotSaleKind(amount) {
  const n = parseConsumableLotSale(amount, 0)
  return CONSUMABLE_LOT_SALE_PRESETS.some((row) => row.id === n) ? String(n) : 'custom'
}

export function consumableLotSalePrice(cost, settings, salePrice) {
  if (salePrice != null && salePrice !== '') return parseConsumableLotSale(salePrice, 0)
  return suggestedSalePrice(
    cost,
    settings?.defaultMarginPercent ?? 40,
    settings?.salePriceRounding ?? 500
  )
}

export function consumableLotItem(cost, settings, salePrice) {
  const unitPrice = consumableLotSalePrice(cost, settings, salePrice)
  return {
    name: CONSUMABLE_LOT_NAME,
    code: '',
    lineType: 'catalog',
    section: 'lot',
    quantity: 1,
    originalQuantity: 1,
    note: '',
    unit: CONSUMABLE_LOT_UNIT,
    unitPrice,
    amount: unitPrice
  }
}
