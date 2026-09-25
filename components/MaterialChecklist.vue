<script setup>
import { CheckIcon } from '@heroicons/vue/24/outline'
import {
  CONSUMABLE_LOT_NAME,
  CONSUMABLE_LOT_UNIT,
  CONSUMABLE_LOT_SALE_DEFAULT,
  CONSUMABLE_LOT_SALE_PRESETS,
  consumableLotSaleKind,
  parseConsumableLotSale
} from '~/utils/consumableLot.js'
import { formatPurchaseConversion, purchasePriceOf, purchaseStockMultiplier, purchaseUnitOf } from '~/utils/cableRoll.js'

const props = defineProps({
  projectId: { type: [Number, String], required: true },
  materials: { type: Array, default: () => [] },
  usages: { type: Array, default: () => [] },
  settings: { type: Object, default: null },
  lotSale: { type: Number, default: CONSUMABLE_LOT_SALE_DEFAULT },
  canEdit: { type: Boolean, default: false }
})

const emit = defineEmits(['saved'])

function usedQty(materialId) {
  return (props.usages || [])
    .filter((row) => Number(row.materialId) === Number(materialId))
    .reduce((sum, row) => sum + Math.max(Math.round(Number(row.quantity) || 0), 0), 0)
}

function emptyDraft() {
  return (props.materials || []).map((row) => {
    const used = usedQty(row.id)
    return {
      materialId: row.id,
      name: row.name,
      unit: row.unit,
      type: row.type,
      pricePerUnit: Math.max(Math.round(Number(row.pricePerUnit) || 0), 0),
      purchaseUnit: row.purchaseUnit,
      unitsPerPurchase: row.unitsPerPurchase,
      stockQuantity: Math.max(Math.round(Number(row.stockQuantity) || 0), 0),
      quantity: used,
      checked: used > 0
    }
  })
}

const draft = ref(emptyDraft())
const lotKind = ref(consumableLotSaleKind(props.lotSale))
const customLotSale = ref(parseConsumableLotSale(props.lotSale))
const saving = ref(false)
const errorMsg = ref('')

watch(
  () => props.lotSale,
  (value) => {
    lotKind.value = consumableLotSaleKind(value)
    customLotSale.value = parseConsumableLotSale(value)
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

watch(
  () => [props.materials, props.usages],
  () => {
    if (!saving.value) draft.value = emptyDraft()
  },
  { deep: true }
)

function available(row) {
  return row.stockQuantity + usedQty(row.materialId)
}

function toggle(row, checked) {
  row.checked = checked
  if (checked && row.quantity <= 0) row.quantity = 1
  if (!checked) row.quantity = 0
}

function setQty(row, value) {
  const qty = Math.max(Math.round(Number(value) || 0), 0)
  row.quantity = Math.min(qty, available(row))
  row.checked = row.quantity > 0
}

const usedRows = computed(() => draft.value.filter((row) => row.quantity > 0))
const lotCost = computed(() =>
  usedRows.value.reduce((sum, row) => sum + row.quantity * row.pricePerUnit, 0)
)
async function save() {
  errorMsg.value = ''
  saving.value = true
  try {
    const saved = await $fetch(`/api/products/${props.projectId}/material-checklist`, {
      method: 'PUT',
      body: {
        items: draft.value.map((row) => ({
          materialId: row.materialId,
          quantity: row.checked ? row.quantity : 0,
          pricePerUnit: row.pricePerUnit
        })),
        lotSale: lotSale.value
      }
    })
    useToast().success('Pemakaian perlengkapan tersimpan.')
    emit('saved', saved)
  } catch (e) {
    errorMsg.value = e.data?.statusMessage || 'Gagal menyimpan pemakaian'
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="space-y-3">
    <p class="text-xs text-ink-500">
      Centang perlengkapan yang dipakai, isi qty dan harga modal bila masih Rp 0.
      Pelanggan hanya melihat <strong>{{ CONSUMABLE_LOT_NAME }} 1 {{ CONSUMABLE_LOT_UNIT }}</strong>.
    </p>
    <div v-if="draft.length" class="overflow-x-auto">
      <table class="table-std text-sm">
        <thead>
          <tr>
            <th class="w-10"></th>
            <th>Perlengkapan</th>
            <th class="text-right">Stok</th>
            <th class="text-right">Harga modal</th>
            <th class="text-right">Qty dipakai</th>
            <th class="text-right">Nilai</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in draft" :key="row.materialId" :class="row.checked ? '' : 'opacity-60'">
            <td>
              <input
                type="checkbox"
                class="h-4 w-4 rounded border-ink-300 accent-teal-600"
                :checked="row.checked"
                :disabled="!canEdit"
                @change="toggle(row, $event.target.checked)"
              />
            </td>
            <td class="font-medium">
              {{ row.name }}
              <div v-if="formatPurchaseConversion(row)" class="text-[11px] text-ink-400 font-normal">
                {{ formatPurchaseConversion(row) }}
              </div>
            </td>
            <td class="num whitespace-nowrap text-ink-500">
              {{ formatNumber(available(row)) }} {{ row.unit }}
            </td>
            <td class="num whitespace-nowrap">
              <IdrInput
                v-if="canEdit"
                v-model="row.pricePerUnit"
                input-class="w-28 ml-auto"
              />
              <span v-else>{{ formatIDR(row.pricePerUnit) }}</span>
              <div class="text-[11px] text-ink-400">/{{ row.unit }}</div>
              <div v-if="purchaseStockMultiplier(row) > 1" class="text-[11px] text-ink-400">
                {{ formatIDR(purchasePriceOf(row)) }}/{{ purchaseUnitOf(row) }}
              </div>
            </td>
            <td class="num whitespace-nowrap">
              <input
                v-if="canEdit"
                :value="row.quantity"
                type="number"
                min="0"
                :max="available(row)"
                step="1"
                class="input-num w-20 ml-auto"
                @input="setQty(row, $event.target.value)"
              />
              <span v-else>{{ formatNumber(row.quantity) }} {{ row.unit }}</span>
            </td>
            <td class="num">{{ formatIDR(row.quantity * row.pricePerUnit) }}</td>
          </tr>
        </tbody>
      </table>
    </div>
    <p v-else class="text-sm text-ink-500">Belum ada master perlengkapan. Tambah di menu Perlengkapan.</p>
    <div class="rounded-panel border border-ink-200 bg-ink-50 px-3 py-2.5 space-y-2">
      <div class="text-sm font-medium">{{ CONSUMABLE_LOT_NAME }} · 1 {{ CONSUMABLE_LOT_UNIT }}</div>
      <p class="text-xs text-ink-500">Modal pemakaian {{ formatIDR(lotCost) }}. Harga ke pelanggan dipilih di bawah.</p>
      <div class="flex flex-wrap gap-1.5">
        <button
          v-for="preset in CONSUMABLE_LOT_SALE_PRESETS"
          :key="preset.id"
          type="button"
          class="px-2.5 h-8 rounded-panel border text-sm"
          :class="lotKind === String(preset.id) ? 'bg-ink-900 text-white border-ink-900' : 'border-ink-200 text-ink-700 hover:bg-white'"
          :disabled="!canEdit"
          @click="setLotKind(String(preset.id))"
        >
          {{ preset.label }}
        </button>
        <button
          type="button"
          class="px-2.5 h-8 rounded-panel border text-sm"
          :class="lotKind === 'custom' ? 'bg-ink-900 text-white border-ink-900' : 'border-ink-200 text-ink-700 hover:bg-white'"
          :disabled="!canEdit"
          @click="setLotKind('custom')"
        >
          Custom
        </button>
      </div>
      <div v-if="lotKind === 'custom'" class="max-w-[12rem]">
        <label class="label">Harga lot custom</label>
        <IdrInput v-model="customLotSale" :disabled="!canEdit" />
      </div>
      <div class="text-sm">Harga jual ke pelanggan <span class="num font-medium">{{ formatIDR(lotSale) }}</span></div>
    </div>
    <p v-if="errorMsg" class="text-sm text-red-600">{{ errorMsg }}</p>
    <div v-if="canEdit" class="flex justify-end">
      <button type="button" class="btn-primary" :disabled="saving" @click="save">
        <CheckIcon class="w-4 h-4" />{{ saving ? 'Menyimpan…' : 'Simpan pemakaian' }}
      </button>
    </div>
  </div>
</template>
