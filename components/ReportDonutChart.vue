<script setup>
const props = defineProps({
  segments: { type: Array, default: () => [] },
  size: { type: Number, default: 168 }
})

const cx = computed(() => props.size / 2)
const cy = computed(() => props.size / 2)
const outerR = computed(() => props.size * 0.42)
const innerR = computed(() => props.size * 0.28)

const total = computed(() => props.segments.reduce((s, x) => s + Math.max(Number(x.value) || 0, 0), 0))

const slices = computed(() => {
  if (!total.value) return []
  let angle = -90
  return props.segments
    .filter((s) => Number(s.value) > 0)
    .map((s) => {
      const value = Number(s.value) || 0
      const sweep = (value / total.value) * 360
      const start = angle
      angle += sweep
      return { ...s, value, sweep, start, pct: Math.round((value / total.value) * 100) }
    })
})

function polar(angle, r) {
  const rad = (angle * Math.PI) / 180
  return {
    x: cx.value + r * Math.cos(rad),
    y: cy.value + r * Math.sin(rad)
  }
}

function slicePath(start, sweep) {
  if (sweep >= 359.99) {
    return [
      `M ${cx.value} ${cy.value - outerR.value}`,
      `A ${outerR.value} ${outerR.value} 0 1 1 ${cx.value - 0.01} ${cy.value - outerR.value}`,
      `L ${cx.value - 0.01} ${cy.value - innerR.value}`,
      `A ${innerR.value} ${innerR.value} 0 1 0 ${cx.value} ${cy.value - innerR.value}`,
      'Z'
    ].join(' ')
  }
  const end = start + sweep
  const large = sweep > 180 ? 1 : 0
  const o1 = polar(start, outerR.value)
  const o2 = polar(end, outerR.value)
  const i2 = polar(end, innerR.value)
  const i1 = polar(start, innerR.value)
  return [
    `M ${o1.x} ${o1.y}`,
    `A ${outerR.value} ${outerR.value} 0 ${large} 1 ${o2.x} ${o2.y}`,
    `L ${i2.x} ${i2.y}`,
    `A ${innerR.value} ${innerR.value} 0 ${large} 0 ${i1.x} ${i1.y}`,
    'Z'
  ].join(' ')
}
</script>

<template>
  <div class="flex flex-col sm:flex-row items-center gap-4">
    <div class="relative shrink-0" :style="{ width: size + 'px', height: size + 'px' }">
      <svg :width="size" :height="size" role="img" aria-label="Diagram pengeluaran">
        <circle v-if="!total" :cx="cx" :cy="cy" :r="(outerR + innerR) / 2" fill="none" stroke="#f5f5f4" :stroke-width="outerR - innerR" />
        <path
          v-for="(s, i) in slices"
          :key="i"
          :d="slicePath(s.start, s.sweep)"
          :fill="s.color"
        >
          <title>{{ s.label }}: {{ formatIDR(s.value) }} ({{ s.pct }}%)</title>
        </path>
      </svg>
      <div class="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center px-3">
        <div class="text-[10px] uppercase tracking-wide text-ink-400">Total</div>
        <div class="font-mono text-sm font-semibold leading-tight">{{ formatIDR(total) }}</div>
      </div>
    </div>
    <ul v-if="slices.length" class="flex-1 w-full space-y-2 text-sm min-w-0">
      <li v-for="(s, i) in slices" :key="i" class="flex items-center justify-between gap-2 min-w-0">
        <span class="inline-flex items-center gap-2 min-w-0">
          <span class="w-2.5 h-2.5 rounded-full shrink-0" :style="{ background: s.color }"></span>
          <span class="truncate">{{ s.label }}</span>
        </span>
        <span class="font-mono text-xs shrink-0 text-ink-600">{{ s.pct }}%</span>
      </li>
    </ul>
    <p v-else class="text-sm text-ink-500">Tidak ada data.</p>
  </div>
</template>
