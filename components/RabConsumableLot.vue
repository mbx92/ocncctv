<script setup>
import { CONSUMABLE_LOT_NAME, CONSUMABLE_LOT_UNIT, CONSUMABLE_LOT_SALE_PRESETS } from '~/utils/consumableLot.js'

defineProps({
  lotKind: { type: String, default: '50000' },
  customLotSale: { type: Number, default: 50000 },
  lotSale: { type: Number, default: 50000 },
  canEdit: { type: Boolean, default: false }
})
const emit = defineEmits(['set-lot-kind', 'update:customLotSale'])
</script>

<template>
  <div class="rounded-panel border border-teal-200 bg-teal-50/40 px-3 py-2.5 space-y-2">
    <div class="text-sm font-medium">{{ CONSUMABLE_LOT_NAME }} · 1 {{ CONSUMABLE_LOT_UNIT }}</div>
    <p class="text-xs text-ink-500">
      Setiap RAB punya lot ini. Pelanggan hanya melihat nama lot, bukan rincian perlengkapan.
      Checklist pemakaian diisi nanti di proyek.
    </p>
    <div class="flex flex-wrap gap-1.5">
      <button
        v-for="preset in CONSUMABLE_LOT_SALE_PRESETS"
        :key="preset.id"
        type="button"
        class="px-2.5 h-8 rounded-panel border text-sm"
        :class="lotKind === String(preset.id) ? 'bg-ink-900 text-white border-ink-900' : 'border-ink-200 text-ink-700 hover:bg-white'"
        :disabled="!canEdit"
        @click="emit('set-lot-kind', String(preset.id))"
      >
        {{ preset.label }}
      </button>
      <button
        type="button"
        class="px-2.5 h-8 rounded-panel border text-sm"
        :class="lotKind === 'custom' ? 'bg-ink-900 text-white border-ink-900' : 'border-ink-200 text-ink-700 hover:bg-white'"
        :disabled="!canEdit"
        @click="emit('set-lot-kind', 'custom')"
      >
        Custom
      </button>
    </div>
    <div v-if="lotKind === 'custom'" class="max-w-[12rem]">
      <label class="label">Harga lot custom</label>
      <IdrInput
        :model-value="customLotSale"
        :disabled="!canEdit"
        @update:model-value="emit('update:customLotSale', $event)"
      />
    </div>
    <div class="text-sm">
      Harga jual ke pelanggan <span class="num font-medium">{{ formatIDR(lotSale) }}</span>
    </div>
  </div>
</template>
