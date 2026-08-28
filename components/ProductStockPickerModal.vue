<script setup>
import { MagnifyingGlassIcon } from '@heroicons/vue/24/outline'

const emit = defineEmits(['close', 'add'])

const { data: allItems } = await useFetch('/api/packaging')
const search = ref('')
const onlyInStock = ref(false)
const page = ref(1)
const pageSize = ref(30)
const selected = ref(new Map())
const searchEl = ref(null)

const suppliers = computed(() => {
  const names = [...new Set((allItems.value || []).map((p) => String(p.supplier || '').trim()).filter(Boolean))]
  return names.sort((a, b) => a.localeCompare(b, 'id'))
})
const supplierFilter = ref('')

const filtered = computed(() => {
  const q = search.value.trim().toLowerCase()
  return (allItems.value || [])
    .filter((p) => !onlyInStock.value || Number(p.stockQuantity) > 0)
    .filter((p) => !supplierFilter.value || p.supplier === supplierFilter.value)
    .filter((p) => !q || p.name.toLowerCase().includes(q) || (p.supplier || '').toLowerCase().includes(q))
    .slice()
    .sort((a, b) => {
      const as = Number(a.stockQuantity) > 0 ? 0 : 1
      const bs = Number(b.stockQuantity) > 0 ? 0 : 1
      if (as !== bs) return as - bs
      return String(a.name || '').localeCompare(String(b.name || ''), 'id')
    })
})

const total = computed(() => filtered.value.length)
const totalPages = computed(() => Math.max(1, Math.ceil(total.value / pageSize.value)))
const rangeStart = computed(() => (total.value ? (page.value - 1) * pageSize.value + 1 : 0))
const rangeEnd = computed(() => Math.min(page.value * pageSize.value, total.value))
const paged = computed(() => {
  const start = (page.value - 1) * pageSize.value
  return filtered.value.slice(start, start + pageSize.value)
})
const selectedCount = computed(() => selected.value.size)
const selectedItems = computed(() => [...selected.value.values()])
const pageAllSelected = computed(
  () => paged.value.length > 0 && paged.value.every((item) => selected.value.has(item.id))
)

watch([search, onlyInStock, supplierFilter, pageSize], () => {
  page.value = 1
})

onMounted(() => {
  nextTick(() => searchEl.value?.focus())
})

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
    for (const item of paged.value) next.delete(item.id)
  } else {
    for (const item of paged.value) next.set(item.id, item)
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

function stockLabel(p) {
  const qty = Number(p.stockQuantity) || 0
  return qty > 0 ? `Stok ${formatNumber(qty)} ${p.unit}` : 'Stok 0'
}
</script>

<template>
  <AppModal title="Produk" size="xl" @close="$emit('close')">
    <div class="-m-4 flex flex-col max-h-[min(78dvh,40rem)]">
      <div class="p-4 pb-3 space-y-2 shrink-0 border-b border-ink-100">
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <div>
            <label class="label">Supplier</label>
            <select v-model="supplierFilter" class="input">
              <option value="">Semua supplier</option>
              <option v-for="s in suppliers" :key="s" :value="s">{{ s }}</option>
            </select>
          </div>
          <div class="sm:col-span-2">
            <label class="label">Cari</label>
            <div class="relative">
              <MagnifyingGlassIcon class="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-ink-400 pointer-events-none" />
              <input
                ref="searchEl"
                v-model="search"
                class="input pl-9 w-full"
                type="search"
                autocomplete="off"
                placeholder="Nama produk…"
              />
            </div>
          </div>
        </div>
        <label class="flex items-center gap-2 text-xs text-ink-600">
          <input v-model="onlyInStock" type="checkbox" class="h-4 w-4 accent-accent-600" />
          Hanya yang ada stok
        </label>
        <p class="text-[11px] text-ink-400">
          Centang beberapa item lalu tambahkan sekaligus. RAB/paket tidak memotong stok.
        </p>
      </div>

      <div class="flex-1 overflow-y-auto min-h-0">
        <p v-if="!filtered.length" class="px-4 py-10 text-center text-sm text-ink-500">
          {{ allItems?.length ? 'Tidak ada produk yang cocok.' : 'Belum ada produk.' }}
          <NuxtLink to="/products" class="block mt-1 text-accent-600 hover:underline">Kelola produk</NuxtLink>
        </p>
        <template v-else>
          <div class="md:hidden divide-y divide-ink-100">
            <label
              v-for="item in paged"
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
                <div class="text-sm font-medium leading-snug break-words">{{ item.name }}</div>
                <div class="text-[11px] text-ink-400 mt-0.5">
                  {{ stockLabel(item) }}
                  <span v-if="item.supplier"> · {{ item.supplier }}</span>
                </div>
              </div>
              <div class="shrink-0 font-mono text-sm font-semibold">{{ formatIDR(item.pricePerUnit) }}</div>
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
                  <th>Nama</th>
                  <th>Stok</th>
                  <th>Supplier</th>
                  <th class="text-right">Harga</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="item in paged"
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
                  <td class="min-w-0">{{ item.name }}</td>
                  <td>
                    <span
                      class="badge"
                      :class="Number(item.stockQuantity) > 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-ink-100 text-ink-500'"
                    >
                      {{ stockLabel(item) }}
                    </span>
                  </td>
                  <td class="text-xs text-ink-500">{{ item.supplier || '—' }}</td>
                  <td class="num font-medium">{{ formatIDR(item.pricePerUnit) }}/{{ item.unit }}</td>
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
