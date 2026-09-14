<script setup>
import { ChevronLeftIcon, ChevronRightIcon, PlusIcon, TrashIcon, CheckIcon, XMarkIcon } from '@heroicons/vue/24/outline'
import { productStatusLabel, productStatusClass, normalizeProductStatus } from '~/utils/productStatus.js'
import {
  CALENDAR_EVENT_KINDS,
  calendarEventKindLabel,
  calendarEventKindClass,
  calendarEventKindDot,
  normalizeCalendarEventKind
} from '~/utils/calendarEvent.js'

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
const { data: visits, refresh: refreshVisits } = await useFetch('/api/calendar-events')
const today = todayStr()
const now = new Date()
const cursor = ref({ year: now.getFullYear(), month: now.getMonth() })
const selectedDate = ref(today)
const statusFilter = ref('')

const showForm = ref(false)
const editing = ref(null)
const form = ref({})
const errorMsg = ref('')
const saving = ref(false)
const acting = ref('')

function toYmd(value) {
  const raw = String(value || '').slice(0, 10)
  return /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : ''
}

function ymd(year, monthIndex, day) {
  return `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function projectEvent(p) {
  const status = normalizeProductStatus(p.status)
  const planned = toYmd(p.plannedStartDate)
  const started = toYmd(p.startedAt)
  const done = toYmd(p.completedAt)
  if (status === 'done' || status === 'pending') {
    if (done) return { date: done, kind: 'Selesai' }
    if (started) return { date: started, kind: 'Mulai' }
    if (planned) return { date: planned, kind: 'Rencana' }
    return null
  }
  if (planned) return { date: planned, kind: started ? 'Mulai' : 'Rencana' }
  if (started) return { date: started, kind: 'Mulai' }
  return null
}

function statusTone(status) {
  const s = normalizeProductStatus(status)
  if (s === 'done') return 'bg-green-100 text-green-800'
  if (s === 'in_progress') return 'bg-sky-100 text-sky-800'
  if (s === 'pending') return 'bg-violet-100 text-violet-800'
  return 'bg-amber-100 text-amber-800'
}

function statusDot(status) {
  const s = normalizeProductStatus(status)
  if (s === 'done') return 'bg-green-500'
  if (s === 'in_progress') return 'bg-sky-500'
  if (s === 'pending') return 'bg-violet-500'
  return 'bg-amber-400'
}

function itemTone(item) {
  return item.source === 'visit' ? calendarEventKindClass(item.kind) : statusTone(item.status)
}

function itemDot(item) {
  return item.source === 'visit' ? calendarEventKindDot(item.kind) : statusDot(item.status)
}

function visitItem(v) {
  const kind = normalizeCalendarEventKind(v.kind)
  return {
    source: 'visit',
    id: `visit-${v.id}`,
    visitId: v.id,
    name: v.title,
    customerName: v.customerName,
    calendarKind: calendarEventKindLabel[kind] || 'Jadwal',
    kind,
    date: toYmd(v.date),
    notes: v.notes,
    customOrderId: v.customOrderId,
    productId: v.productId
  }
}

function projectItem(p, event) {
  return {
    source: 'project',
    id: `project-${p.id}`,
    projectId: p.id,
    name: p.name,
    customerName: p.customerName,
    calendarKind: event.kind,
    status: p.status,
    date: event.date
  }
}

const visibleProjects = computed(() =>
  (products.value || []).filter((p) => {
    if (statusFilter.value && statusFilter.value !== 'visit' && normalizeProductStatus(p.status) !== statusFilter.value) {
      return false
    }
    return true
  })
)

const visibleVisits = computed(() => {
  if (statusFilter.value && statusFilter.value !== 'visit') return []
  return (visits.value || []).map(visitItem).filter((v) => v.date)
})

const unscheduled = computed(() =>
  statusFilter.value === 'visit' ? [] : visibleProjects.value.filter((p) => !projectEvent(p))
)

const eventsByDate = computed(() => {
  const { year, month } = cursor.value
  const monthStart = ymd(year, month, 1)
  const monthEnd = ymd(year, month, new Date(year, month + 1, 0).getDate())
  const map = {}
  function add(item) {
    if (!item.date || item.date < monthStart || item.date > monthEnd) return
    if (!map[item.date]) map[item.date] = []
    map[item.date].push(item)
  }
  if (statusFilter.value !== 'visit') {
    for (const p of visibleProjects.value) {
      const event = projectEvent(p)
      if (event) add(projectItem(p, event))
    }
  }
  for (const v of visibleVisits.value) add(v)
  for (const list of Object.values(map)) {
    list.sort((a, b) => {
      if (a.source !== b.source) return a.source === 'visit' ? -1 : 1
      return String(a.name).localeCompare(String(b.name), 'id')
    })
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

const selectedItems = computed(() => eventsByDate.value[selectedDate.value] || [])

const monthLabel = computed(() => `${MONTHS_LONG[cursor.value.month]} ${cursor.value.year}`)

const monthCount = computed(() => {
  const ids = new Set()
  for (const list of Object.values(eventsByDate.value)) {
    for (const item of list) ids.add(item.id)
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

function openAdd(date = selectedDate.value) {
  editing.value = null
  form.value = {
    date: date || today,
    kind: 'survey',
    customerName: '',
    title: '',
    notes: ''
  }
  errorMsg.value = ''
  showForm.value = true
}

function openEdit(item) {
  if (item.source !== 'visit') return
  editing.value = item
  form.value = {
    date: item.date,
    kind: item.kind || 'survey',
    customerName: item.customerName || '',
    title: item.name || '',
    notes: item.notes || ''
  }
  errorMsg.value = ''
  showForm.value = true
}

async function saveVisit() {
  errorMsg.value = ''
  saving.value = true
  try {
    if (editing.value) {
      await $fetch(`/api/calendar-events/${editing.value.visitId}`, { method: 'PUT', body: form.value })
    } else {
      await $fetch('/api/calendar-events', { method: 'POST', body: form.value })
    }
    selectedDate.value = form.value.date
    showForm.value = false
    await refreshVisits()
    useToast().success(editing.value ? 'Jadwal diperbarui.' : 'Jadwal tersimpan.')
  } catch (e) {
    errorMsg.value = e.data?.statusMessage || 'Gagal menyimpan jadwal'
  } finally {
    saving.value = false
  }
}

async function removeVisit() {
  if (!editing.value) return
  if (!(await useConfirm().confirm(`Hapus jadwal "${editing.value.name}"?`))) return
  acting.value = 'delete'
  try {
    await $fetch(`/api/calendar-events/${editing.value.visitId}`, { method: 'DELETE' })
    showForm.value = false
    await refreshVisits()
    useToast().success('Jadwal dihapus.')
  } catch (e) {
    errorMsg.value = e.data?.statusMessage || 'Gagal menghapus'
  } finally {
    acting.value = ''
  }
}

async function createRabFromVisit() {
  if (!editing.value) return
  if (!String(form.value.customerName || '').trim()) {
    errorMsg.value = 'Isi nama pelanggan dulu sebelum buat RAB'
    return
  }
  acting.value = 'rab'
  errorMsg.value = ''
  try {
    if (editing.value.name !== form.value.title || editing.value.customerName !== form.value.customerName || editing.value.notes !== form.value.notes || editing.value.date !== form.value.date || editing.value.kind !== form.value.kind) {
      await $fetch(`/api/calendar-events/${editing.value.visitId}`, { method: 'PUT', body: form.value })
    }
    const created = await $fetch(`/api/calendar-events/${editing.value.visitId}/rab`, {
      method: 'POST',
      body: {
        customerName: form.value.customerName,
        title: form.value.title,
        notes: form.value.notes
      }
    })
    await refreshVisits()
    showForm.value = false
    useToast().success('RAB draft dibuat dari jadwal ini.')
    await navigateTo(`/rab/${created.rab.id}`)
  } catch (e) {
    errorMsg.value = e.data?.statusMessage || 'Gagal membuat RAB'
  } finally {
    acting.value = ''
  }
}
</script>

<template>
  <div class="space-y-4">
    <div class="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 class="text-xl font-bold">Kalender</h1>
        <p class="text-xs text-ink-500 mt-0.5">
          Jadwal cek lokasi dan meeting sebelum RAB, plus tanggal proyek.
        </p>
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
          :class="statusFilter === 'visit' ? 'bg-orange-600 text-white border-orange-600' : 'bg-white text-ink-600 border-ink-200'"
          @click="statusFilter = 'visit'"
        >
          Jadwal
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
          :class="statusFilter === 'pending' ? 'bg-violet-600 text-white border-violet-600' : 'bg-white text-ink-600 border-ink-200'"
          @click="statusFilter = 'pending'"
        >
          Pending
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
            <div class="text-[11px] text-ink-400 mt-0.5">{{ monthCount }} jadwal</div>
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
                  v-for="item in cell.items.slice(0, 3)"
                  :key="item.id"
                  class="block truncate rounded px-1 py-0.5 text-[11px] leading-snug font-medium"
                  :class="itemTone(item)"
                >
                  {{ item.name }}
                </span>
                <span v-if="cell.items.length > 3" class="text-[10px] text-ink-400 px-1">
                  +{{ cell.items.length - 3 }}
                </span>
              </div>

              <div v-if="cell.items.length" class="sm:hidden flex gap-0.5 mt-auto pb-0.5">
                <span
                  v-for="item in cell.items.slice(0, 3)"
                  :key="item.id"
                  class="w-1.5 h-1.5 rounded-full"
                  :class="itemDot(item)"
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
                {{ selectedItems.length ? selectedItems.length + ' jadwal' : 'Tidak ada jadwal' }}
              </div>
            </div>
            <button type="button" class="btn-secondary !h-8 !min-h-8 px-2.5 text-xs" @click="openAdd(selectedDate)">
              <PlusIcon class="w-3.5 h-3.5" />Tambah
            </button>
          </div>
          <div v-if="selectedItems.length" class="divide-y divide-ink-100">
            <template v-for="item in selectedItems" :key="item.id">
              <NuxtLink
                v-if="item.source === 'project'"
                :to="`/projects/${item.projectId}`"
                class="flex items-start gap-3 px-4 py-3 hover:bg-ink-50 w-full text-left"
              >
                <span class="mt-1.5 w-2 h-2 rounded-full shrink-0" :class="itemDot(item)" />
                <div class="min-w-0 flex-1">
                  <div class="font-medium text-sm break-words leading-snug">{{ item.name }}</div>
                  <div class="text-xs text-ink-500 mt-0.5">
                    {{ item.calendarKind }}{{ item.customerName ? ` · ${item.customerName}` : '' }}
                  </div>
                </div>
                <span class="badge shrink-0" :class="productStatusClass(item.status)">
                  {{ productStatusLabel[item.status] || item.status }}
                </span>
              </NuxtLink>
              <button
                v-else
                type="button"
                class="flex items-start gap-3 px-4 py-3 hover:bg-ink-50 w-full text-left"
                @click="openEdit(item)"
              >
                <span class="mt-1.5 w-2 h-2 rounded-full shrink-0" :class="itemDot(item)" />
                <div class="min-w-0 flex-1">
                  <div class="font-medium text-sm break-words leading-snug">{{ item.name }}</div>
                  <div class="text-xs text-ink-500 mt-0.5">
                    {{ item.calendarKind }}{{ item.customerName ? ` · ${item.customerName}` : '' }}
                  </div>
                </div>
                <span class="badge shrink-0" :class="calendarEventKindClass(item.kind)">
                  {{ item.customOrderId ? 'RAB' : item.calendarKind }}
                </span>
              </button>
            </template>
          </div>
          <p v-else class="px-4 py-8 text-sm text-ink-400 text-center">Belum ada jadwal di tanggal ini.</p>
        </div>

        <div v-if="unscheduled.length" class="panel overflow-hidden">
          <div class="panel-header">
            <div>
              <div class="panel-title">Proyek belum dijadwalkan</div>
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

    <AppModal :title="editing ? 'Ubah jadwal' : 'Tambah jadwal'" v-if="showForm" @close="showForm = false">
      <form class="space-y-3" @submit.prevent="saveVisit">
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label class="label">Tanggal</label>
            <input v-model="form.date" type="date" class="input" required />
          </div>
          <div>
            <label class="label">Jenis</label>
            <select v-model="form.kind" class="input">
              <option v-for="k in CALENDAR_EVENT_KINDS" :key="k" :value="k">{{ calendarEventKindLabel[k] }}</option>
            </select>
          </div>
        </div>
        <div>
          <label class="label">Nama pelanggan</label>
          <input v-model="form.customerName" class="input" placeholder="opsional, wajib jika buat RAB" />
        </div>
        <div>
          <label class="label">Judul</label>
          <input v-model="form.title" class="input" required placeholder="bebas, mis. survey rumah Pak Budi" />
        </div>
        <div>
          <label class="label">Catatan</label>
          <textarea v-model="form.notes" class="input min-h-[4.5rem]" placeholder="alamat, yang perlu dicek, jam, dll." />
        </div>
        <p v-if="errorMsg" class="text-sm text-red-600">{{ errorMsg }}</p>
        <div class="flex flex-wrap justify-end gap-2 pt-1">
          <button v-if="editing" type="button" class="btn-action-danger mr-auto" :disabled="!!acting" @click="removeVisit">
            <TrashIcon class="w-4 h-4" />Hapus
          </button>
          <button type="button" class="btn-secondary" @click="showForm = false">
            <XMarkIcon class="w-4 h-4" />Batal
          </button>
          <button
            v-if="editing?.customOrderId"
            type="button"
            class="btn-secondary"
            @click="navigateTo(`/rab/${editing.customOrderId}`)"
          >
            Buka RAB
          </button>
          <button
            v-else-if="editing"
            type="button"
            class="btn-secondary"
            :disabled="!!acting || saving"
            @click="createRabFromVisit"
          >
            {{ acting === 'rab' ? 'Membuat…' : 'Buat RAB' }}
          </button>
          <button type="submit" class="btn-primary" :disabled="saving || !!acting">
            <CheckIcon class="w-4 h-4" />{{ saving ? 'Menyimpan…' : 'Simpan' }}
          </button>
        </div>
      </form>
    </AppModal>
  </div>
</template>
