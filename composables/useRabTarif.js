import { toValue } from 'vue'

function qtyInt(value) {
  return Math.max(Math.round(Number(value) || 0), 1)
}

function writeLines(lines, next) {
  if (lines && typeof lines === 'object' && 'value' in lines) lines.value = next
}

// Masukkan tarif/jasa master (atau baris jasa ketik sendiri) ke draft baris RAB.
export function useRabTarif(lines) {
  const { list: serviceList } = useServices()

  function addFromMaster(item) {
    if (!item) return
    const next = [...(toValue(lines) || [])]
    const existing = next.findIndex(
      (line) => line.lineType === 'service' && item.id && line.serviceId === item.id
    )
    if (existing >= 0) {
      next[existing] = {
        ...next[existing],
        quantity: qtyInt(next[existing].quantity) + 1
      }
    } else {
      next.push({
        lineType: 'service',
        catalogItemId: null,
        serviceId: item.id,
        packagingId: null,
        name: item.name,
        code: '',
        unit: item.unit || 'titik',
        quantity: 1,
        costPrice: 0,
        salePrice: Number(item.salePrice) || 0
      })
    }
    writeLines(lines, next)
  }

  function addCustom() {
    writeLines(lines, [
      ...(toValue(lines) || []),
      {
        lineType: 'service',
        catalogItemId: null,
        serviceId: null,
        packagingId: null,
        name: '',
        code: '',
        unit: 'titik',
        quantity: 1,
        costPrice: 0,
        salePrice: 0
      }
    ])
  }

  return { serviceList, addFromMaster, addCustom }
}
