import { toValue } from 'vue'
import {
  CONSUMABLE_LOT_SALE_DEFAULT,
  CONSUMABLE_LOT_SALE_PRESETS,
  consumableLotSaleKind,
  parseConsumableLotSale
} from '~/utils/consumableLot.js'

// Harga lot Consumable & Material di RAB. Pelanggan melihat 1 Lot, bukan rincian perlengkapan.
export function useRabConsumableLot(source) {
  const lotKind = ref(consumableLotSaleKind(toValue(source)))
  const customLotSale = ref(parseConsumableLotSale(toValue(source)))

  function syncFrom(value) {
    lotKind.value = consumableLotSaleKind(value)
    customLotSale.value = parseConsumableLotSale(value)
  }

  watch(
    () => toValue(source),
    (value) => {
      if (value == null) return
      syncFrom(value)
    }
  )

  const lotSale = computed(() => {
    if (lotKind.value === 'custom') return parseConsumableLotSale(customLotSale.value, 0)
    return Number(lotKind.value) || CONSUMABLE_LOT_SALE_DEFAULT
  })

  function setLotKind(kind) {
    lotKind.value = kind
    if (kind !== 'custom') customLotSale.value = Number(kind)
  }

  return {
    lotKind,
    customLotSale,
    lotSale,
    setLotKind,
    presets: CONSUMABLE_LOT_SALE_PRESETS
  }
}
