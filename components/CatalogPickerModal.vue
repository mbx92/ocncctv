<script setup>
import { MagnifyingGlassIcon } from '@heroicons/vue/24/outline'

const emit = defineEmits(['close', 'add'])

const { data: meta } = await useFetch('/api/catalog')
const sheets = computed(() => meta.value?.sheets || [])

const filters = ref({ q: '', sheetKey: '', category: '' })
const page = ref(1)
const pageSize = ref(30)
const items = ref([])
const total = ref(0)
const categories = ref([])
const loading = ref(false)
const errorMsg = ref('')
const selected = ref(new Map())
const searchEl = ref(null)
let timer

const totalPages = computed(() => Math.max(1, Math.ceil(total.value / pageSize.value)))
const rangeStart = computed(() => (total.value ? (page.value - 1) * pageSize.value + 1 : 0))
const rangeEnd = computed(() => Math.min(page.value * pageSize.value, total.value))
const selectedCount = computed(() => selected.value.size)
const selectedItems = computed(() => [...selected.value.values()])
const pageAllSelected = computed(
  () => items.value.length > 0 && items.value.every((item) => selected.value.has(item.id))
)
const canQuery = computed(
  () => !!filters.value.sheetKey || !!filters.value.category || filters.value.q.trim().length >= 2
)

const query = computed(() => ({
  q: filters.value.q.trim(),
  sheetKey: filters.value.sheetKey,
  category: filters.value.category,
  page: page.value,
  pageSize: pageSize.value
}))

function scheduleFetch() {
  clearTimeout(timer)
  timer = setTimeout(fetchItems, 250)
}

async function fetchItems() {
  if (!canQuery.value) {
    items.value = []
    total.value = 0
    if (!filters.value.sheetKey) categories.value = []
    errorMsg.value = ''
    return
  }
  loading.value = true
  errorMsg.value = ''
  try {
    const data = await $fetch('/api/catalog/search', { query: query.value })
    items.value = data.items || []
    total.value = data.total || 0
    if (Array.isArray(data.categories)) categories.value = data.categories
  } catch (e) {
    errorMsg.value = e.data?.statusMessage || 'Gagal memuat katalog'
    items.value = []
    total.value = 0
  } finally {
    loading.value = false
  }
}

watch(
  () => filters.value.sheetKey,
  () => {
    filters.value.category = ''
    page.value = 1
    scheduleFetch()
  }
)
watch(
  () => [filters.value.q, filters.value.category],
  () => {
    page.value = 1
    scheduleFetch()
  }
)
watch(page, scheduleFetch)
watch(pageSize, () => {
  page.value = 1
  scheduleFetch()
})
onMounted(() => {
  nextTick(() => searchEl.value?.focus())
})
onUnmounted(() => clearTimeout(timer))

function isSelected(id) {
  return selected.value.has(id)
}

function toggle(item) {
  const next = new Map(selected.value)
  if (next.has(item.id)) next.delete(item.id)
  else next.set(item.id, item)
  selected.value = next
}

function togglePage() {
  const next = new Map(selected.value)
  if (pageAllSelected.value) {
    for (const item of items.value) next.delete(item.id)
  } else {
    for (const item of items.value) next.set(item.id, item)
  }
  selected.value = next
}

function clearSelected() {
  selected.value = new Map()
}

function confirmAdd() {
  if (!selectedCount.value) return
  emit('add', selectedItems.value)
  clearSelected()
  emit('close')
}
</script>

<template>
  <AppModal title="Katalog supplier" size="xl" @close="$emit('close')">
    <div class="-m-4 flex flex-col max-h-[min(78dvh,40rem)]">
      <div class="p-4 pb-3 space-y-2 shrink-0 border-b border-ink-100">
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <div class="sm:col-span-1">
            <label class="label">Brand / tab</label>
            <select v-model="filters.sheetKey" class="input">
              <option value="">Semua brand</option>
              <option v-for="sheet in sheets" :key="sheet.key" :value="sheet.key">{{ sheet.label }}</option>
            </select>
          </div>
          <div>
            <label class="label">Jenis</label>
            <select v-model="filters.category" class="input" :disabled="!categories.length">
              <option value="">Semua jenis</option>
              <option v-for="cat in categories" :key="cat" :value="cat">{{ cat }}</option>
            </select>
          </div>
          <div>
            <label class="label">Cari</label>
            <div class="relative">
              <MagnifyingGlassIcon class="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-ink-400 pointer-events-none" />
              <input
                ref="searchEl"
                v-model="filters.q"
                class="input pl-9 w-full"
                type="search"
                autocomplete="off"
                placeholder="Kode atau nama…"
              />
            </div>
          </div>
        </div>
        <p class="text-[11px] text-ink-400">
          Pilih brand, atau ketik minimal 2 huruf. Centang beberapa item lalu tambahkan sekaligus.
        </p>
      </div>

      <div class="flex-1 overflow-y-auto min-h-0">
        <p v-if="errorMsg" class="px-4 py-3 text-sm text-red-600">{{ errorMsg }}</p>
        <p v-else-if="!canQuery" class="px-4 py-10 text-center text-sm text-ink-500">
          Pilih brand di atas, atau cari nama/kode barang.
        </p>
        <p v-else-if="loading" class="px-4 py-10 text-center text-sm text-ink-500">Memuat…</p>
        <p v-else-if="!items.length" class="px-4 py-10 text-center text-sm text-ink-500">Tidak ada item.</p>
        <template v-else>
          <div class="md:hidden divide-y divide-ink-100">
            <label
              v-for="item in items"
              :key="item.id"
              class="flex items-start gap-3 px-4 py-3 active:bg-ink-50"
            >
              <input
                type="checkbox"
                class="mt-1 h-4 w-4 accent-accent-600"
                :checked="isSelected(item.id)"
                @change="toggle(item)"
              />
              <div class="min-w-0 flex-1">
                <div class="font-mono text-[11px] text-accent-700">{{ item.code }}</div>
                <div class="text-sm font-medium leading-snug mt-0.5 break-words">{{ item.name }}</div>
                <div class="text-[11px] text-ink-400 mt-0.5">
                  {{ item.sheetLabel }}
                  <span v-if="item.category"> · {{ item.category }}</span>
                </div>
              </div>
              <div class="shrink-0 font-mono text-sm font-semibold">{{ formatIDR(item.supplierPrice) }}</div>
            </label>
          </div>
          <div class="hidden md:block overflow-x-auto">
            <table class="table-std">
              <thead>
                <tr>
                  <th class="w-10">
                    <input
                      type="checkbox"
                      class="h-4 w-4 accent-accent-600"
                      :checked="pageAllSelected"
                      @change="togglePage"
                    />
                  </th>
                  <th>Kode</th>
                  <th>Nama</th>
                  <th>Brand</th>
                  <th>Jenis</th>
                  <th class="text-right">Modal</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="item in items"
                  :key="item.id"
                  class="cursor-pointer hover:bg-ink-50"
                  :class="isSelected(item.id) ? 'bg-accent-50' : ''"
                  @click="toggle(item)"
                >
                  <td @click.stop>
                    <input
                      type="checkbox"
                      class="h-4 w-4 accent-accent-600"
                      :checked="isSelected(item.id)"
                      @change="toggle(item)"
                    />
                  </td>
                  <td class="font-mono text-xs whitespace-nowrap text-accent-700">{{ item.code }}</td>
                  <td class="min-w-0">{{ item.name }}</td>
                  <td class="text-xs text-ink-500 whitespace-nowrap">{{ item.sheetLabel }}</td>
                  <td>
                    <span v-if="item.category" class="badge bg-ink-100 text-ink-600">{{ item.category }}</span>
                    <span v-else class="text-ink-300">—</span>
                  </td>
                  <td class="num font-medium">{{ formatIDR(item.supplierPrice) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </template>
      </div>

      <div class="shrink-0 border-t border-ink-200 bg-white p-3 sm:p-4 space-y-2">
        <AppPagination
          v-if="total"
          v-model:page="page"
          v-model:pageSize="pageSize"
          :total-pages="totalPages"
          :total="total"
          :range-start="rangeStart"
          :range-end="rangeEnd"
          :page-size-options="[30, 50, 100]"
        />
        <div class="flex flex-wrap items-center justify-between gap-2">
          <p class="text-xs text-ink-500">
            {{ selectedCount ? selectedCount + ' item dipilih' : 'Belum ada yang dipilih' }}
            <button
              v-if="selectedCount"
              type="button"
              class="text-accent-600 hover:underline ml-1"
              @click="clearSelected"
            >
              hapus pilihan
            </button>
          </p>
          <div class="flex gap-2 ml-auto">
            <button type="button" class="btn-secondary" @click="$emit('close')">Batal</button>
            <button type="button" class="btn-primary" :disabled="!selectedCount" @click="confirmAdd">
              Tambahkan {{ selectedCount ? selectedCount + ' item' : '' }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </AppModal>
</template>
