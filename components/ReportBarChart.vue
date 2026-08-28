<script setup>
import { formatChartAxis } from '~/utils/chartColors.js'

const props = defineProps({
  labels: { type: Array, default: () => [] },
  series: { type: Array, default: () => [] },
  height: { type: Number, default: 220 },
  allowNegative: { type: Boolean, default: false }
})

const pad = { top: 10, right: 12, bottom: 32, left: 52 }
const minWidth = computed(() => Math.max(props.labels.length * 56, 280))
const innerH = computed(() => props.height - pad.top - pad.bottom)

const scale = computed(() => {
  let maxPos = 0
  let maxNeg = 0
  for (const s of props.series) {
    for (const v of s.data || []) {
      const n = Number(v) || 0
      if (n >= 0) maxPos = Math.max(maxPos, n)
      else maxNeg = Math.max(maxNeg, Math.abs(n))
    }
  }
  if (!props.allowNegative) maxNeg = 0
  const max = Math.max(maxPos, maxNeg, 1)
  return { maxPos: max, maxNeg, max }
})

const zeroY = computed(() => {
  if (!props.allowNegative || !scale.value.maxNeg) return pad.top + innerH.value
  const ratio = scale.value.maxNeg / (scale.value.maxPos + scale.value.maxNeg)
  return pad.top + innerH.value * ratio
})

function valueY(v) {
  const n = Number(v) || 0
  const range = scale.value.maxPos + scale.value.maxNeg
  if (!props.allowNegative || !scale.value.maxNeg) {
    const h = (Math.max(n, 0) / scale.value.max) * innerH.value
    return pad.top + innerH.value - h
  }
  if (n >= 0) {
    const h = (n / range) * innerH.value
    return zeroY.value - h
  }
  const h = (Math.abs(n) / range) * innerH.value
  return zeroY.value
}

function valueH(v) {
  const n = Number(v) || 0
  const range = scale.value.maxPos + scale.value.maxNeg
  if (!props.allowNegative || !scale.value.maxNeg) {
    return (Math.max(n, 0) / scale.value.max) * innerH.value
  }
  return (Math.abs(n) / range) * innerH.value
}

function groupWidth() {
  return (minWidth.value - pad.left - pad.right) / Math.max(props.labels.length, 1)
}

function barGeom(groupIndex, seriesIndex) {
  const gw = groupWidth()
  const count = Math.max(props.series.length, 1)
  const barW = Math.min(16, Math.max(8, (gw - 10) / count))
  const gx = pad.left + groupIndex * gw
  const x = gx + (gw - barW * count) / 2 + seriesIndex * barW
  return { x, w: barW }
}

const yTicks = computed(() => {
  const ticks = props.allowNegative && scale.value.maxNeg ? [-1, -0.5, 0, 0.5, 1] : [0, 0.25, 0.5, 0.75, 1]
  return ticks.map((t) => {
    if (!props.allowNegative || !scale.value.maxNeg) {
      const val = scale.value.max * t
      return { val, y: pad.top + innerH.value - t * innerH.value }
    }
    const range = scale.value.maxPos + scale.value.maxNeg
    const val = t >= 0 ? t * scale.value.maxPos : t * scale.value.maxNeg
    const y = zeroY.value - (val / range) * innerH.value
    return { val, y }
  })
})

const bars = computed(() => {
  const out = []
  props.labels.forEach((label, gi) => {
    props.series.forEach((s, si) => {
      const v = Number(s.data?.[gi]) || 0
      if (!v && v !== 0) return
      const { x, w } = barGeom(gi, si)
      const y = valueY(v)
      const h = Math.max(valueH(v), v ? 2 : 0)
      out.push({
        key: `${gi}-${si}`,
        x,
        y: v >= 0 || !props.allowNegative ? y : zeroY.value,
        w,
        h,
        v,
        color: typeof s.color === 'function' ? s.color(v, gi) : s.color,
        label: s.label
      })
    })
  })
  return out
})
</script>

<template>
  <div class="overflow-x-auto">
    <svg :width="minWidth" :height="height" class="block max-w-none" role="img" :aria-label="series.map((s) => s.label).join(', ')">
      <line
        :x1="pad.left"
        :y1="allowNegative && scale.maxNeg ? zeroY : pad.top + innerH"
        :x2="minWidth - pad.right"
        :y2="allowNegative && scale.maxNeg ? zeroY : pad.top + innerH"
        stroke="#e7e5e4"
        stroke-width="1"
      />
      <g v-for="(tick, i) in yTicks" :key="'y' + i">
        <line
          :x1="pad.left"
          :y1="tick.y"
          :x2="minWidth - pad.right"
          :y2="tick.y"
          stroke="#f5f5f4"
          stroke-width="1"
        />
        <text :x="pad.left - 6" :y="tick.y + 4" text-anchor="end" class="fill-ink-400 text-[10px] font-mono">
          {{ formatChartAxis(tick.val) }}
        </text>
      </g>
      <rect
        v-for="b in bars"
        :key="b.key"
        :x="b.x"
        :y="b.y"
        :width="b.w"
        :height="b.h"
        :fill="b.color"
        rx="2"
      >
        <title>{{ b.label }}: {{ formatIDR(b.v) }}</title>
      </rect>
      <text
        v-for="(label, i) in labels"
        :key="'x' + i"
        :x="pad.left + i * groupWidth() + groupWidth() / 2"
        :y="height - 8"
        text-anchor="middle"
        class="fill-ink-500 text-[10px]"
      >
        {{ label }}
      </text>
    </svg>
    <div v-if="series.length" class="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-ink-600">
      <span v-for="s in series" :key="s.label" class="inline-flex items-center gap-1.5">
        <span class="w-2.5 h-2.5 rounded-sm shrink-0" :style="{ background: typeof s.color === 'function' ? s.color(1) : s.color }"></span>
        {{ s.label }}
      </span>
    </div>
  </div>
</template>
