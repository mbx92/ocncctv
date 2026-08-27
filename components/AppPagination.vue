<script setup>
import { ChevronLeftIcon, ChevronRightIcon, ChevronDownIcon } from '@heroicons/vue/24/outline'

const props = defineProps({
  page: { type: Number, required: true },
  pageSize: { type: Number, required: true },
  totalPages: { type: Number, required: true },
  total: { type: Number, required: true },
  rangeStart: { type: Number, required: true },
  rangeEnd: { type: Number, required: true },
  pageSizeOptions: { type: Array, default: () => [10, 25, 50, 100] }
})
const emit = defineEmits(['update:page', 'update:pageSize'])

const sizeOptions = computed(() => {
  const set = new Set(props.pageSizeOptions.map(Number).filter((n) => n > 0))
  set.add(Number(props.pageSize) || 10)
  return [...set].sort((a, b) => a - b)
})

// Tampilkan maksimal 5 nomor halaman di sekitar halaman aktif; sisanya
// dijangkau lewat tombol panah agar tidak meluber di layar sempit.
const pageNumbers = computed(() => {
  const span = 5
  let start = Math.max(props.page - Math.floor(span / 2), 1)
  const end = Math.min(start + span - 1, props.totalPages)
  start = Math.max(Math.min(start, end - span + 1), 1)
  const out = []
  for (let i = start; i <= end; i++) out.push(i)
  return out
})

function go(p) {
  if (p >= 1 && p <= props.totalPages && p !== props.page) emit('update:page', p)
}

function onPageSize(e) {
  emit('update:pageSize', Number(e.target.value))
}
</script>

<template>
  <div
    v-if="total > 0"
    class="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 px-3 py-2.5 border-t border-ink-200"
  >
    <div class="flex items-center gap-2 min-w-0 order-2 sm:order-1">
      <p class="text-xs text-ink-500 tabular-nums whitespace-nowrap">
        {{ rangeStart }}–{{ rangeEnd }}
        <span class="text-ink-400">dari</span>
        {{ total }}
      </p>
      <label class="relative inline-flex items-center shrink-0">
        <span class="sr-only">Baris per halaman</span>
        <select
          :value="pageSize"
          class="h-10 appearance-none rounded-panel border border-ink-200 bg-white pl-2.5 pr-7 text-xs font-medium text-ink-700 tabular-nums cursor-pointer hover:border-ink-300 focus:outline-none focus:ring-2 focus:ring-accent-400 focus:border-accent-400"
          @change="onPageSize"
        >
          <option v-for="n in sizeOptions" :key="n" :value="n">{{ n }}</option>
        </select>
        <ChevronDownIcon class="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-ink-400" />
      </label>
      <span class="hidden sm:inline text-xs text-ink-400">per halaman</span>
    </div>

    <nav
      v-if="totalPages > 1"
      class="inline-flex items-center self-start sm:self-auto rounded-panel border border-ink-200 bg-white overflow-hidden divide-x divide-ink-200 order-1 sm:order-2"
      aria-label="Navigasi halaman"
    >
      <button
        type="button"
        class="h-10 w-10 inline-flex items-center justify-center text-ink-600 hover:bg-ink-50 disabled:text-ink-300 disabled:hover:bg-transparent disabled:cursor-not-allowed touch-manipulation"
        :disabled="page === 1"
        aria-label="Halaman sebelumnya"
        @click="go(page - 1)"
      >
        <ChevronLeftIcon class="w-4 h-4" />
      </button>
      <button
        v-for="n in pageNumbers"
        :key="n"
        type="button"
        class="h-10 min-w-10 px-2.5 text-xs font-medium tabular-nums transition-colors touch-manipulation"
        :class="n === page ? 'bg-accent-500 text-white' : 'text-ink-600 hover:bg-ink-50'"
        :aria-current="n === page ? 'page' : undefined"
        :aria-label="`Halaman ${n}`"
        @click="go(n)"
      >
        {{ n }}
      </button>
      <button
        type="button"
        class="h-10 w-10 inline-flex items-center justify-center text-ink-600 hover:bg-ink-50 disabled:text-ink-300 disabled:hover:bg-transparent disabled:cursor-not-allowed touch-manipulation"
        :disabled="page === totalPages"
        aria-label="Halaman berikutnya"
        @click="go(page + 1)"
      >
        <ChevronRightIcon class="w-4 h-4" />
      </button>
    </nav>
  </div>
</template>
