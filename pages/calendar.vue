<script setup>
import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/vue/24/outline'
import { productStatusLabel, productStatusClass, normalizeProductStatus } from '~/utils/productStatus.js'

const MONTHS_LONG = [
  'Januari',
  'Februari',
  'Maret',
  'April',
  'Mei',
  'Juni',
  'Juli',
  'Agustus',
  'September',
  'Oktober',
  'November',
  'Desember'
]
const WEEKDAYS = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min']

const { data: products } = await useFetch('/api/products')
const today = todayStr()
const now = new Date()
const cursor = ref({ year: now.getFullYear(), month: now.getMonth() })
const selectedDate = ref(today)
const statusFilter = ref('')

function toYmd(value) {
  const raw = String(value || '').slice(0, 10)
  return /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : ''
}

function ymd(year, monthIndex, day) {
  return `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function projectRange(p) {
  const status = normalizeProductStatus(p.status)
  const planned = toYmd(p.plannedStartDate)
  const started = toYmd(p.startedAt)
  const done = toYmd(p.completedAt)
  if (status === 'done') {
    const from = started || planned || done
    const to = done || started || planned
    return from && to ? { from, to } : null
  }
  if (status === 'in_progress') {
    const from = started || planned
    return from ? { from, to: from > today ? from : today } : null
  }
  return planned ? { from: planned, to: planned } : null
}

function statusTone(status) {
  const s = normalizeProductStatus(status)
  if (s === 'done') return 'bg-green-100 text-green-800'
  if (s === 'in_progress') return 'bg-sky-100 text-sky-800'
  return 'bg-amber-100 text-amber-800'
}

function statusDot(status) {
  const s = normalizeProductStatus(status)
  if (s === 'done') return 'bg-green-500'
  if (s === 'in_progress') return 'bg-sky-500'
  return 'bg-amber-400'
}

const visibleProjects = computed(() =>
  (products.value || []).filter((p) => {
    if (statusFilter.value && normalizeProductStatus(p.status) !== statusFilter.value) return false
    return true
  })
)

const unscheduled = computed(() => visibleProjects.value.filter((p) => !projectRange(p)))

const eventsByDate = computed(() => {
  const { year, month } = cursor.value
  const monthStart = ymd(year, month, 1)
  const monthEnd = ymd(year, month, new Date(year, month + 1, 0).getDate())
  const map = {}
  for (const p of visibleProjects.value) {
    const range = projectRange(p)
    if (!range) continue
    const from = range.from < monthStart ? monthStart : range.from
    const to = range.to > monthEnd ? monthEnd : range.to
    if (from > to) continue
    const startDay = Number(from.slice(8))
    const endDay = Number(to.slice(8))
    for (let d = startDay; d <= endDay; d++) {
      const date = ymd(year, month, d)
      if (!map[date]) map[date] = []
      map[date].push(p)
    }
  }
  return map
})

const monthCells = computed(() => {
  const { year, month } = cursor.value
  const first = new Date(year, month, 1)
  const lead = (first.getDay() + 6) % 7
  const days = new Date(year, month + 1, 0).getDate()
  const cells = []
  for (let i = 0; i < lead; i++) cells.push({ date: null, weekend: i >= 5 })
  for (let d = 1; d <= days; d++) {
    const date = ymd(year, month, d)
    const weekday = (lead + d - 1) % 7
    cells.push({
      date,
      weekend: weekday >= 5,
      items: eventsByDate.value[date] || [],
      today: date === today,
      selected: date === selectedDate.value
    })
  }
  while (cells.length % 7) {
    const weekday = cells.length % 7
    cells.push({ date: null, weekend: weekday >= 5 })
  }
  return cells
})

const selectedProjects = computed(() => eventsByDate.value[selectedDate.value] || [])

const monthLabel = computed(() => `${MONTHS_LONG[cursor.value.month]} ${cursor.value.year}`)

const monthCount = computed(() => {
  const ids = new Set()
  for (const list of Object.values(eventsByDate.value)) {
    for (const p of list) ids.add(p.id)
  }
  return ids.size
})

function shiftMonth(delta) {
  const d = new Date(cursor.value.year, cursor.value.month + delta, 1)
  cursor.value = { year: d.getFullYear(), month: d.getMonth() }
  const isThisMonth = d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()
  selectedDate.value = isThisMonth ? today : ymd(d.getFullYear(), d.getMonth(), 1)
}

function goToday() {
  const d = new Date()
  cursor.value = { year: d.getFullYear(), month: d.getMonth() }
  selectedDate.value = today
}

function selectDay(date) {
  if (date) selectedDate.value = date
}
</script>

<template>
  <div class="space-y-4">
    <div class="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 class="text-xl font-bold">Kalender</h1>
        <p class="text-xs text-ink-500 mt-0.5">Jadwal proyek pemasangan.</p>
      </div>
      <div class="flex gap-1 overflow-x-auto no-scrollbar">
        <button
          type="button"
          class="shrink-0 h-9 px-3 rounded-full text-xs font-semibold border"
          :class="statusFilter === '' ? 'bg-ink-900 text-white border-ink-900' : 'bg-white text-ink-600 border-ink-200'"
          @click="statusFilter = ''"
        >
          Semua
        </button>
        <button
          type="button"
          class="shrink-0 h-9 px-3 rounded-full text-xs font-semibold border"
          :class="statusFilter === 'waiting' ? 'bg-amber-600 text-white border-amber-600' : 'bg-white text-ink-600 border-ink-200'"
          @click="statusFilter = 'waiting'"
        >
          Menunggu
        </button>
        <button
          type="button"
          class="shrink-0 h-9 px-3 rounded-full text-xs font-semibold border"
          :class="statusFilter === 'in_progress' ? 'bg-sky-600 text-white border-sky-600' : 'bg-white text-ink-600 border-ink-200'"
          @click="statusFilter = 'in_progress'"
        >
          Berjalan
        </button>
        <button
          type="button"
          class="shrink-0 h-9 px-3 rounded-full text-xs font-semibold border"
          :class="statusFilter === 'done' ? 'bg-green-700 text-white border-green-700' : 'bg-white text-ink-600 border-ink-200'"
          @click="statusFilter = 'done'"
        >
          Selesai
        </button>
      </div>
    </div>

    <div class="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_20rem] gap-4">
      <div class="panel overflow-hidden min-w-0">
        <div class="flex items-center gap-2 px-3 sm:px-4 py-3 border-b border-ink-200">
          <button type="button" class="btn-secondary px-2.5" aria-label="Bulan sebelumnya" @click="shiftMonth(-1)">
            <ChevronLeftIcon class="w-4 h-4" />
          </button>
          <div class="flex-1 text-center min-w-0">
            <div class="font-semibold leading-tight">{{ monthLabel }}</div>
            <div class="text-[11px] text-ink-400 mt-0.5">{{ monthCount }} proyek</div>
          </div>
          <button type="button" class="btn-secondary px-2.5" aria-label="Bulan berikutnya" @click="shiftMonth(1)">
            <ChevronRightIcon class="w-4 h-4" />
          </button>
          <button type="button" class="btn-secondary hidden sm:inline-flex" @click="goToday">Hari ini</button>
        </div>
        <div class="sm:hidden px-3 py-2 border-b border-ink-100">
          <button type="button" class="btn-secondary w-full" @click="goToday">Hari ini</button>
        </div>

        <div class="grid grid-cols-7 bg-ink-50 border-b border-ink-200">
          <div
            v-for="day in WEEKDAYS"
            :key="day"
            class="py-2 text-center text-[10px] sm:text-xs font-semibold tracking-wide text-ink-500"
          >
            {{ day }}
          </div>
        </div>

        <div class="grid grid-cols-7 gap-px bg-ink-200">
          <div
            v-for="(cell, i) in monthCells"
            :key="i"
            class="min-h-[3.25rem] sm:min-h-[6.75rem]"
            :class="cell.date ? 'bg-white' : 'bg-ink-50'"
          >
            <button
              v-if="cell.date"
              type="button"
              class="w-full h-full p-1 sm:p-1.5 text-left flex flex-col gap-1"
              :class="cell.selected ? 'bg-accent-50' : cell.weekend ? 'bg-ink-50/80' : 'hover:bg-ink-50'"
              @click="selectDay(cell.date)"
            >
              <div class="flex items-center justify-between">
                <span
                  class="inline-flex items-center justify-center w-6 h-6 text-xs font-medium tabular-nums rounded-full"
                  :class="
                    cell.today
                      ? 'bg-accent-500 text-white'
                      : cell.selected
                        ? 'text-accent-800 font-semibold'
                        : cell.weekend
                          ? 'text-ink-400'
                          : 'text-ink-700'
                  "
                >
                  {{ Number(cell.date.slice(8)) }}
                </span>
                <span v-if="cell.items.length" class="sm:hidden text-[10px] font-mono text-ink-400">
                  {{ cell.items.length }}
                </span>
              </div>

              <div class="hidden sm:flex flex-col gap-0.5 min-h-0">
                <span
                  v-for="p in cell.items.slice(0, 3)"
                  :key="p.id"
                  class="block truncate rounded px-1 py-0.5 text-[11px] leading-snug font-medium"
                  :class="statusTone(p.status)"
                >
                  {{ p.name }}
                </span>
                <span v-if="cell.items.length > 3" class="text-[10px] text-ink-400 px-1">
                  +{{ cell.items.length - 3 }}
                </span>
              </div>

              <div v-if="cell.items.length" class="sm:hidden flex gap-0.5 mt-auto pb-0.5">
                <span
                  v-for="p in cell.items.slice(0, 3)"
                  :key="p.id"
                  class="w-1.5 h-1.5 rounded-full"
                  :class="statusDot(p.status)"
                />
              </div>
            </button>
          </div>
        </div>
      </div>

      <div class="space-y-4 min-w-0">
        <div class="panel overflow-hidden">
          <div class="panel-header">
            <div>
              <div class="panel-title !normal-case !tracking-normal">{{ formatDate(selectedDate) }}</div>
              <div class="text-[11px] text-ink-400 mt-0.5">
                {{ selectedProjects.length ? selectedProjects.length + ' proyek' : 'Tidak ada proyek' }}
              </div>
            </div>
          </div>
          <div v-if="selectedProjects.length" class="divide-y divide-ink-100">
            <NuxtLink
              v-for="p in selectedProjects"
              :key="p.id"
              :to="`/projects/${p.id}`"
              class="flex items-start gap-3 px-4 py-3 hover:bg-ink-50"
            >
              <span class="mt-1.5 w-2 h-2 rounded-full shrink-0" :class="statusDot(p.status)" />
              <div class="min-w-0 flex-1">
                <div class="font-medium text-sm break-words leading-snug">{{ p.name }}</div>
                <div v-if="p.customerName" class="text-xs text-ink-500 mt-0.5">{{ p.customerName }}</div>
              </div>
              <span class="badge shrink-0" :class="productStatusClass(p.status)">
                {{ productStatusLabel[p.status] || p.status }}
              </span>
            </NuxtLink>
          </div>
          <p v-else class="px-4 py-8 text-sm text-ink-400 text-center">Pilih tanggal di kalender.</p>
        </div>

        <div v-if="unscheduled.length" class="panel overflow-hidden">
          <div class="panel-header">
            <div>
              <div class="panel-title">Belum dijadwalkan</div>
              <div class="text-[11px] text-ink-400 mt-0.5">{{ unscheduled.length }} proyek</div>
            </div>
          </div>
          <div class="divide-y divide-ink-100 max-h-64 overflow-y-auto">
            <NuxtLink
              v-for="p in unscheduled"
              :key="p.id"
              :to="`/projects/${p.id}`"
              class="flex items-center justify-between gap-2 px-4 py-2.5 hover:bg-ink-50"
            >
              <span class="text-sm font-medium truncate">{{ p.name }}</span>
              <span class="badge shrink-0" :class="productStatusClass(p.status)">
                {{ productStatusLabel[p.status] || p.status }}
              </span>
            </NuxtLink>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
