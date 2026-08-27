<script setup>
import { MagnifyingGlassIcon, ArrowPathIcon, ArrowDownTrayIcon } from '@heroicons/vue/24/outline'

const isAdmin = computed(() => useState('authUser').value?.role === 'admin')
const { data: meta, refresh: refreshMeta } = await useFetch('/api/catalog')

const sheets = computed(() => meta.value?.sheets || [])
const supplierName = computed(() => meta.value?.supplierName || 'Supplier')
const lastSyncedAt = ref(meta.value?.lastSyncedAt || null)
watch(
  () => meta.value?.lastSyncedAt,
  (v) => {
    if (v) lastSyncedAt.value = v
  }
)

const activeSheet = ref(sheets.value[0]?.key || '')
watch(sheets, (list) => {
  if (!activeSheet.value && list[0]?.key) activeSheet.value = list[0].key
})

const search = ref('')
const items = ref([])
const source = ref('database')
const loading = ref(false)
const syncing = ref(false)
const errorMsg = ref('')
const syncMessage = ref('')

const activeSheetLabel = computed(
  () => sheets.value.find((s) => s.key === activeSheet.value)?.label || activeSheet.value
)

const { page, pageSize, paged, total, totalPages, rangeStart, rangeEnd, reset } = usePagination(
  computed(() => items.value),
  15
)
watch(items, reset)

function formatDateTime(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })
}

function priceUp(item) {
  return item.lastPrice != null && item.supplierPrice > item.lastPrice
}
function priceDown(item) {
  return item.lastPrice != null && item.supplierPrice < item.lastPrice
}

async function copyName(name) {
  const text = String(name || '').trim()
  if (!text) return
  try {
    await navigator.clipboard.writeText(text)
    useToast().success('Nama item disalin')
  } catch {
    useToast().error('Tidak bisa menyalin nama')
  }
}

async function fetchItems() {
  if (!activeSheet.value) return
  loading.value = true
  errorMsg.value = ''
  try {
    const data = await $fetch(`/api/catalog/${activeSheet.value}/items`, {
      query: search.value.trim() ? { q: search.value.trim() } : {}
    })
    items.value = data.items || []
    source.value = data.source || 'database'
    if (data.lastSyncedAt) lastSyncedAt.value = data.lastSyncedAt
  } catch (e) {
    errorMsg.value = e.data?.statusMessage || 'Gagal memuat katalog.'
    items.value = []
  } finally {
    loading.value = false
  }
}

async function runSync() {
  if (syncing.value) return
  syncing.value = true
  errorMsg.value = ''
  syncMessage.value = ''
  try {
    const data = await $fetch('/api/catalog/sync', { method: 'POST', timeout: 300000 })
    syncMessage.value = data.message || 'Sync selesai.'
    if (data.lastSyncedAt) lastSyncedAt.value = data.lastSyncedAt
    await refreshMeta()
    await fetchItems()
    useToast().success(syncMessage.value)
  } catch (e) {
    errorMsg.value = e.data?.statusMessage || 'Gagal sync katalog dari Google Sheets.'
    useToast().error(errorMsg.value)
  } finally {
    syncing.value = false
  }
}

function selectSheet(key) {
  if (activeSheet.value === key) return
  activeSheet.value = key
}

watch(activeSheet, async (key) => {
  search.value = ''
  await nextTick()
  const el = document.querySelector(`[data-sheet-key="${key}"]`)
  el?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' })
})

let timer
watch([activeSheet, search], () => {
  clearTimeout(timer)
  timer = setTimeout(fetchItems, 250)
})

onMounted(fetchItems)
onUnmounted(() => clearTimeout(timer))
</script>

<template>
  <div class="space-y-3 sm:space-y-4">
    <div class="flex items-start justify-between gap-2">
      <div class="min-w-0">
        <h1 class="text-xl font-bold">Katalog Supplier</h1>
        <p class="text-xs text-ink-500 mt-1 truncate">
          {{ supplierName }}
          <span class="hidden sm:inline"> — sync {{ formatDateTime(lastSyncedAt) }}</span>
        </p>
        <p class="sm:hidden text-xs text-ink-400 mt-0.5">Sync {{ formatDateTime(lastSyncedAt) }}</p>
      </div>
      <div class="flex items-center gap-1.5 shrink-0">
        <button
          class="btn-secondary px-2.5 sm:px-3"
          :disabled="loading || syncing"
          aria-label="Refresh"
          @click="fetchItems"
        >
          <ArrowPathIcon class="w-4 h-4" :class="loading ? 'animate-spin' : ''" />
          <span class="hidden sm:inline">Refresh</span>
        </button>
        <button
          v-if="isAdmin"
          class="btn-primary px-2.5 sm:px-3"
          :disabled="loading || syncing"
          title="Tarik semua brand dari Google Sheets"
          @click="runSync"
        >
          <ArrowDownTrayIcon class="w-4 h-4" />
          <span class="hidden sm:inline">{{ syncing ? 'Sync…' : 'Sync' }}</span>
          <span class="sm:hidden">{{ syncing ? '…' : 'Sync' }}</span>
        </button>
      </div>
    </div>

    <p v-if="syncMessage" class="text-sm text-teal-700 bg-teal-50 border border-teal-200 rounded-panel px-3 py-2">
      {{ syncMessage }}
    </p>
    <p v-if="errorMsg" class="text-sm text-red-600">{{ errorMsg }}</p>

    <!-- Filter mobile: chip brand + cari, nempel di bawah topbar PWA -->
    <div
      class="md:hidden sticky top-topbar-safe z-30 -mx-3 sm:-mx-4 px-3 sm:px-4 py-2 bg-ink-100/95 backdrop-blur-md border-b border-ink-200 space-y-2"
    >
      <div class="flex gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
        <button
          v-for="sheet in sheets"
          :key="sheet.key"
          :data-sheet-key="sheet.key"
          type="button"
          class="shrink-0 h-9 px-3 rounded-full text-xs font-semibold whitespace-nowrap touch-manipulation border"
          :class="
            activeSheet === sheet.key
              ? 'bg-ink-900 text-white border-ink-900'
              : 'bg-white text-ink-700 border-ink-200'
          "
          @click="selectSheet(sheet.key)"
        >
          {{ sheet.label }}
        </button>
      </div>
      <div class="relative">
        <MagnifyingGlassIcon class="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-ink-400 pointer-events-none" />
        <input
          v-model="search"
          class="input pl-9 w-full"
          type="search"
          enterkeyhint="search"
          autocomplete="off"
          placeholder="Kode, nama, jenis…"
        />
      </div>
      <p class="text-[11px] text-ink-400">
        {{ activeSheetLabel }} · {{ total }} item
        <span v-if="source === 'remote'">· Sheets (belum disimpan)</span>
        <span v-if="total"> · tap kartu untuk salin nama</span>
      </p>
    </div>

    <div class="panel">
      <div class="panel-header hidden md:flex">
        <span class="panel-title">Daftar harga — {{ activeSheetLabel }}</span>
        <span class="text-xs text-ink-400">
          {{ total }} item
          <span v-if="source === 'remote'">· Google Sheets (belum disimpan)</span>
        </span>
      </div>
      <div class="hidden md:flex p-3 border-b border-ink-200 flex-col sm:flex-row gap-2 sm:items-end">
        <div class="w-full sm:max-w-xs">
          <label class="label">Brand</label>
          <select v-model="activeSheet" class="input">
            <option v-for="sheet in sheets" :key="sheet.key" :value="sheet.key">{{ sheet.label }}</option>
          </select>
        </div>
        <div class="relative w-full sm:max-w-md flex-1">
          <label class="label">Cari</label>
          <div class="relative">
            <MagnifyingGlassIcon class="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-ink-400 pointer-events-none" />
            <input
              v-model="search"
              class="input pl-9 w-full"
              type="search"
              enterkeyhint="search"
              autocomplete="off"
              placeholder="Kode, nama, jenis…"
            />
          </div>
        </div>
      </div>

      <div v-if="loading" class="p-10 text-center text-sm text-ink-500">Memuat…</div>

      <div v-else>
        <!-- Kartu (HP / PWA) -->
        <div class="md:hidden">
        <div v-if="total" class="divide-y divide-ink-100">
          <button
            v-for="item in paged"
            :key="item.ref"
            type="button"
            class="w-full text-left px-3 py-3 flex items-start gap-3 touch-manipulation active:bg-ink-50"
            @click="copyName(item.name)"
          >
            <div class="min-w-0 flex-1">
              <div class="font-mono text-[11px] text-accent-700">{{ item.code }}</div>
              <div class="text-sm font-medium leading-snug mt-0.5 break-words">{{ item.name }}</div>
              <span v-if="item.category" class="badge bg-ink-100 text-ink-600 mt-1.5">{{ item.category }}</span>
            </div>
            <div class="shrink-0 text-right pt-0.5">
              <div class="font-mono font-semibold text-sm whitespace-nowrap">{{ formatIDR(item.supplierPrice) }}</div>
              <div v-if="priceUp(item) || priceDown(item)" class="text-[11px] mt-0.5 whitespace-nowrap">
                <span class="text-ink-400 line-through">{{ formatIDR(item.lastPrice) }}</span>
                <span :class="priceUp(item) ? 'text-red-600' : 'text-teal-600'">
                  {{ priceUp(item) ? ' ↑' : ' ↓' }}
                </span>
              </div>
            </div>
          </button>
        </div>
        <p v-else class="p-8 text-center text-sm text-ink-500">
          Tidak ada item.
          <span v-if="isAdmin"> Sync untuk mengisi dari Google Sheets.</span>
          <span v-else> Minta admin menjalankan sync.</span>
        </p>
        <AppPagination
          v-if="total"
          v-model:page="page"
          v-model:pageSize="pageSize"
          :total-pages="totalPages"
          :total="total"
          :range-start="rangeStart"
          :range-end="rangeEnd"
          :page-size-options="[15, 25, 50]"
        />
      </div>

      <!-- Tabel (desktop) -->
      <div class="hidden md:block overflow-x-auto">
        <table class="table-std">
          <thead>
            <tr>
              <th>Kode</th>
              <th>Nama Item</th>
              <th>Jenis</th>
              <th class="text-right hidden lg:table-cell">Harga sebelumnya</th>
              <th class="text-right">Harga supplier</th>
              <th class="hidden lg:table-cell">Last update</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in paged" :key="item.ref" class="cursor-pointer hover:bg-ink-50" @click="copyName(item.name)">
              <td class="font-mono text-xs whitespace-nowrap text-accent-700">{{ item.code }}</td>
              <td>{{ item.name }}</td>
              <td><span class="badge bg-ink-100 text-ink-600">{{ item.category }}</span></td>
              <td class="num text-ink-400 hidden lg:table-cell">
                {{ item.lastPrice != null ? formatIDR(item.lastPrice) : '—' }}
              </td>
              <td class="num font-medium">
                {{ formatIDR(item.supplierPrice) }}
                <span v-if="priceUp(item)" class="text-red-600 text-xs font-normal"> ↑</span>
                <span v-else-if="priceDown(item)" class="text-teal-600 text-xs font-normal"> ↓</span>
              </td>
              <td class="text-xs text-ink-500 whitespace-nowrap hidden lg:table-cell">
                {{ formatDateTime(item.lastSyncedAt) }}
              </td>
            </tr>
            <tr v-if="!total">
              <td colspan="6" class="text-center py-8 text-ink-400">
                Tidak ada item.
                <span v-if="isAdmin"> Klik Sync untuk mengisi dari Google Sheets.</span>
                <span v-else> Minta admin menjalankan sync katalog.</span>
              </td>
            </tr>
          </tbody>
        </table>
        <AppPagination
          v-if="total"
          v-model:page="page"
          v-model:pageSize="pageSize"
          :total-pages="totalPages"
          :total="total"
          :range-start="rangeStart"
          :range-end="rangeEnd"
          :page-size-options="[15, 25, 50, 100]"
        />
      </div>
      </div>
    </div>

    <div class="hidden md:block panel p-4 text-sm text-ink-500 space-y-1">
      <p class="font-medium text-ink-700">Cara pakai</p>
      <p>1. Pilih brand, cari kode/nama, lihat harga beli supplier. Tap item untuk menyalin nama.</p>
      <p>2. Nanti item ini bisa dipilih ke RAB/budget project (HPP terisi dari harga katalog).</p>
      <p>3. Admin menekan Sync untuk memperbarui semua tab dari spreadsheet.</p>
    </div>
  </div>
</template>
