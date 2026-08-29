<script setup>
import { chartPalette } from '~/utils/chartColors.js'

const props = defineProps({
  netRevenue: { type: Number, default: 0 },
  cogs: { type: Number, default: 0 },
  operatingExpenses: { type: Number, default: 0 },
  netProfit: { type: Number, default: 0 }
})

const segments = computed(() => {
  const rev = Math.max(Number(props.netRevenue) || 0, 0)
  const cogs = Math.max(Number(props.cogs) || 0, 0)
  const opex = Math.max(Number(props.operatingExpenses) || 0, 0)
  const profit = Number(props.netProfit) || 0
  const base = rev || cogs + opex + Math.abs(profit) || 1
  const items = [
    { key: 'cogs', label: 'Biaya material', value: cogs, color: chartPalette.cogs },
    { key: 'opex', label: 'Operasional', value: opex, color: chartPalette.opex },
    {
      key: 'profit',
      label: profit >= 0 ? 'Laba bersih' : 'Rugi bersih',
      value: Math.abs(profit),
      color: profit >= 0 ? chartPalette.netProfit : chartPalette.netLoss
    }
  ].filter((s) => s.value > 0)
  return { rev, base, items }
})

function width(v) {
  return `${Math.max((v / segments.value.base) * 100, v ? 1 : 0)}%`
}
</script>

<template>
  <div class="space-y-3">
    <div class="flex items-center justify-between text-sm gap-2">
      <span class="text-ink-500">Revenue bersih</span>
      <span class="font-mono font-semibold text-teal-700">{{ formatIDR(segments.rev) }}</span>
    </div>
    <div v-if="segments.items.length" class="h-8 rounded-panel bg-ink-100 overflow-hidden flex">
      <div
        v-for="s in segments.items"
        :key="s.key"
        class="h-full flex items-center justify-center text-[10px] font-medium text-white/90 min-w-[2px]"
        :style="{ width: width(s.value), background: s.color }"
        :title="`${s.label}: ${formatIDR(s.value)}`"
      >
        <span v-if="s.value / segments.base > 0.12" class="truncate px-1">{{ s.label }}</span>
      </div>
    </div>
    <ul class="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
      <li v-for="s in segments.items" :key="s.key" class="flex items-center gap-1.5 min-w-0">
        <span class="w-2 h-2 rounded-sm shrink-0" :style="{ background: s.color }"></span>
        <span class="truncate text-ink-600">{{ s.label }}</span>
        <span class="font-mono text-ink-500 ml-auto shrink-0">{{ formatIDR(s.value) }}</span>
      </li>
    </ul>
    <p v-if="!segments.items.length" class="text-sm text-ink-500 text-center py-2">Tidak ada data pada rentang ini.</p>
  </div>
</template>
