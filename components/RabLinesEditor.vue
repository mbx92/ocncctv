<script setup>
import { MagnifyingGlassIcon, PlusIcon, MinusIcon, TrashIcon } from '@heroicons/vue/24/outline'
import { lineAmount, lineCost, rabLineTypeBadge, rabLineTypeLabel, suggestedSalePrice } from '~/utils/rab.js'

const props = defineProps({
  modelValue: { type: Array, default: () => [] },
  disabled: Boolean,
  marginPercent: { type: Number, default: 40 }
})
const emit = defineEmits(['update:modelValue'])

const lines = computed({
  get: () => props.modelValue || [],
  set: (v) => emit('update:modelValue', v)
})

const { data: services } = await useFetch('/api/services')
const serviceList = computed(() => services.value || [])
const showCatalog = ref(false)
const showServicePicker = ref(false)

function patch(index, fields) {
  const next = lines.value.map((line, i) => (i === index ? { ...line, ...fields } : line))
  lines.value = next
}

function qtyInt(value) {
  return Math.max(Math.round(Number(value) || 0), 1)
}

function patchQty(index, value) {
  patch(index, { quantity: qtyInt(value) })
}

function bumpQty(index, delta) {
  const line = lines.value[index]
  if (!line) return
  patchQty(index, qtyInt(line.quantity) + delta)
}

function removeLine(index) {
  lines.value = lines.value.filter((_, i) => i !== index)
}

function addCatalogItems(items) {
  const next = [...lines.value]
  let added = 0
  for (const item of items) {
    const existing = next.findIndex((l) => l.lineType === 'catalog' && l.catalogItemId === item.id)
    if (existing >= 0) {
      next[existing] = {
        ...next[existing],
        quantity: qtyInt(next[existing].quantity) + 1
      }
    } else {
      const cost = Number(item.supplierPrice) || 0
      next.push({
        lineType: 'catalog',
        catalogItemId: item.id,
        serviceId: null,
        name: item.name,
        code: item.code || '',
        unit: null,
        quantity: 1,
        costPrice: cost,
        salePrice: suggestedSalePrice(cost, props.marginPercent)
      })
    }
    added += 1
  }
  lines.value = next
  showCatalog.value = false
  if (added) useToast().success(added === 1 ? '1 item ditambahkan.' : `${added} item ditambahkan.`)
}

function addServiceFromMaster(item) {
  lines.value = [
    ...lines.value,
    {
      lineType: 'service',
      catalogItemId: null,
      serviceId: item.id,
      name: item.name,
      code: '',
      unit: item.unit || 'titik',
      quantity: 1,
      costPrice: 0,
      salePrice: Number(item.salePrice) || 0
    }
  ]
  showServicePicker.value = false
}

function addCustomService() {
  lines.value = [
    ...lines.value,
    {
      lineType: 'service',
      catalogItemId: null,
      serviceId: null,
      name: '',
      code: '',
      unit: 'titik',
      quantity: 1,
      costPrice: 0,
      salePrice: 0
    }
  ]
  showServicePicker.value = false
}

function toggleServicePicker() {
  if (!serviceList.value.length) {
    addCustomService()
    return
  }
  showServicePicker.value = !showServicePicker.value
}

const totals = computed(() => {
  let totalSale = 0
  let totalCost = 0
  for (const line of lines.value) {
    totalSale += lineAmount(line)
    totalCost += lineCost(line)
  }
  return { totalSale, totalCost, margin: totalSale - totalCost }
})
</script>

<template>
  <div class="space-y-3">
    <div v-if="!disabled" class="flex flex-col sm:flex-row gap-2">
      <button type="button" class="btn-secondary flex-1" @click="showCatalog = true">
        <MagnifyingGlassIcon class="w-4 h-4" />Cari katalog
      </button>
      <div class="relative shrink-0">
        <button type="button" class="btn-secondary w-full sm:w-auto" @click="toggleServicePicker">
          <PlusIcon class="w-4 h-4" />Jasa
        </button>
        <div
          v-if="showServicePicker"
          class="absolute z-20 right-0 mt-1 w-72 max-w-[calc(100vw-2rem)] max-h-64 overflow-y-auto rounded-panel border border-ink-200 bg-white shadow-lg"
        >
          <button
            v-for="item in serviceList"
            :key="item.id"
            type="button"
            class="w-full text-left px-3 py-2 text-sm hover:bg-purple-50 border-b border-ink-100"
            @click="addServiceFromMaster(item)"
          >
            <div class="font-medium break-words">{{ item.name }}</div>
            <div class="text-xs text-ink-400">
              {{ item.unit }} · {{ formatIDR(item.salePrice) }}
            </div>
          </button>
          <button
            type="button"
            class="w-full text-left px-3 py-2 text-sm text-ink-600 hover:bg-ink-50 border-b border-ink-100"
            @click="addCustomService"
          >
            Ketik jasa lain…
          </button>
          <NuxtLink to="/jasa" class="block px-3 py-2 text-xs text-accent-600 hover:underline">
            Kelola master jasa
          </NuxtLink>
        </div>
      </div>
    </div>
    <p v-if="!disabled" class="text-xs text-ink-500">
      Barang dari katalog: filter brand/jenis, bisa pilih banyak item sekaligus. Jasa dari master, atau diketik. Tidak ada stok.
    </p>

    <div v-if="!lines.length" class="rounded-panel border border-dashed border-ink-200 p-4 text-sm text-ink-500 text-center">
      Belum ada baris. Pilih barang dari katalog, atau pilih jasa.
    </div>

    <div v-else class="space-y-2">
      <div
        v-for="(line, i) in lines"
        :key="i"
        class="rounded-panel border p-3 space-y-2"
        :class="line.lineType === 'service' ? 'border-purple-200 bg-purple-50/40' : 'border-ink-200'"
      >
        <div v-if="line.lineType === 'service'" class="space-y-2">
          <div class="flex items-center justify-between gap-2">
            <span class="badge shrink-0" :class="rabLineTypeBadge(line.lineType)">
              {{ rabLineTypeLabel(line.lineType) }}
            </span>
            <button
              v-if="!disabled"
              type="button"
              class="text-red-500 hover:text-red-700 shrink-0"
              @click="removeLine(i)"
            >
              <TrashIcon class="w-4 h-4" />
            </button>
          </div>
          <input
            v-if="!disabled"
            :value="line.name"
            class="input"
            required
            placeholder="mis. pasang kamera outdoor"
            @input="patch(i, { name: $event.target.value })"
          />
          <div v-else class="font-medium break-words text-sm">{{ line.name }}</div>
          <p class="text-xs text-purple-700/80">Tidak ada stok dan tidak ada harga modal.</p>
        </div>
        <div v-else class="flex items-start gap-2">
          <span class="badge shrink-0 mt-0.5" :class="rabLineTypeBadge(line.lineType)">
            {{ rabLineTypeLabel(line.lineType) }}
          </span>
          <div class="min-w-0 flex-1">
            <div class="font-medium break-words text-sm">{{ line.name }}</div>
            <div v-if="line.code" class="text-xs font-mono text-ink-400">{{ line.code }}</div>
          </div>
          <button
            v-if="!disabled"
            type="button"
            class="text-red-500 hover:text-red-700 shrink-0"
            @click="removeLine(i)"
          >
            <TrashIcon class="w-4 h-4" />
          </button>
        </div>
        <div
          class="grid gap-2"
          :class="line.lineType === 'service' ? 'grid-cols-2 sm:grid-cols-3' : 'grid-cols-2 sm:grid-cols-4'"
        >
          <div>
            <label class="label">{{ line.lineType === 'service' ? 'Qty kerja' : 'Qty' }}</label>
            <div class="flex gap-1">
              <button
                type="button"
                class="btn-secondary px-2.5"
                :disabled="disabled || qtyInt(line.quantity) <= 1"
                @click="bumpQty(i, -1)"
              >
                <MinusIcon class="w-4 h-4" />
              </button>
              <input
                :value="qtyInt(line.quantity)"
                type="number"
                min="1"
                step="1"
                inputmode="numeric"
                class="input-num w-full"
                :disabled="disabled"
                required
                @change="patchQty(i, $event.target.value)"
              />
              <button
                type="button"
                class="btn-secondary px-2.5"
                :disabled="disabled"
                @click="bumpQty(i, 1)"
              >
                <PlusIcon class="w-4 h-4" />
              </button>
            </div>
            <p v-if="line.lineType === 'service'" class="text-[11px] text-ink-400 mt-0.5">
              {{ line.unit || 'titik / jam / paket' }}
            </p>
          </div>
          <div v-if="line.lineType !== 'service'">
            <label class="label">Modal</label>
            <div class="input-display">{{ formatIDR(line.costPrice) }}</div>
          </div>
          <div>
            <label class="label">Harga jual</label>
            <IdrInput
              :model-value="line.salePrice"
              :disabled="disabled"
              input-class="w-full"
              @update:model-value="patch(i, { salePrice: $event })"
            />
          </div>
          <div>
            <label class="label">Subtotal</label>
            <div class="input-display">{{ formatIDR(lineAmount(line)) }}</div>
          </div>
        </div>
      </div>
    </div>

    <div class="flex flex-wrap justify-end gap-x-4 gap-y-1 text-sm">
      <span class="text-ink-500">Modal {{ formatIDR(totals.totalCost) }}</span>
      <span class="font-medium">Jual {{ formatIDR(totals.totalSale) }}</span>
      <span :class="totals.margin >= 0 ? 'text-green-700' : 'text-red-600'">
        Margin {{ formatIDR(totals.margin) }}
      </span>
    </div>

    <CatalogPickerModal v-if="showCatalog" @close="showCatalog = false" @add="addCatalogItems" />
  </div>
</template>
