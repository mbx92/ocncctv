<script setup>
const props = defineProps({
  items: { type: Array, default: () => [] },
  valueKey: { type: String, default: 'value' },
  labelKey: { type: String, default: 'label' },
  colorKey: { type: String, default: 'color' },
  signed: { type: Boolean, default: false }
})

const maxAbs = computed(() => {
  let m = 1
  for (const item of props.items) {
    m = Math.max(m, Math.abs(Number(item[props.valueKey]) || 0))
  }
  return m
})

function barWidth(v) {
  return `${Math.max((Math.abs(Number(v) || 0) / maxAbs.value) * 100, Number(v) ? 2 : 0)}%`
}
</script>

<template>
  <div class="space-y-2.5">
    <div v-for="(item, i) in items" :key="i" class="space-y-1">
      <div class="flex items-center justify-between gap-2 text-sm min-w-0">
        <span class="font-medium truncate">{{ item[labelKey] }}</span>
        <span
          class="font-mono text-xs shrink-0"
          :class="signed && Number(item[valueKey]) < 0 ? 'text-red-600' : 'text-ink-600'"
        >
          {{ formatIDR(item[valueKey]) }}
        </span>
      </div>
      <div class="h-2 rounded-full bg-ink-100 overflow-hidden">
        <div
          class="h-full rounded-full transition-all"
          :class="signed && Number(item[valueKey]) < 0 ? 'bg-red-400/80' : ''"
          :style="{
            width: barWidth(item[valueKey]),
            background: !signed || Number(item[valueKey]) >= 0 ? item[colorKey] || '#0d9488' : undefined
          }"
        ></div>
      </div>
    </div>
    <p v-if="!items.length" class="text-sm text-ink-500 text-center py-4">Tidak ada data.</p>
  </div>
</template>
