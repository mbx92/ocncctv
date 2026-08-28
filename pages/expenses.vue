<script setup>
import { PlusIcon, PencilSquareIcon, TrashIcon, CheckIcon, XMarkIcon } from '@heroicons/vue/24/outline'
import { categoryBadgeClass, categoryNameOf } from '~/utils/expenseCategory.js'

const filters = ref({ category: '', productId: '', dateFrom: '', dateTo: '' })

const query = computed(() => {
  const q = {}
  for (const [k, v] of Object.entries(filters.value)) if (v) q[k] = v
  return q
})
const { data: expenses, refresh } = await useFetch('/api/expenses', { query })
const { data: products } = await useFetch('/api/products')
const { data: categories, refresh: refreshCategories } = await useFetch('/api/expense-categories')
const { data: technicians, refresh: refreshTechnicians } = await useFetch('/api/technicians')

const grandTotal = computed(() => (expenses.value || []).reduce((a, e) => a + e.amount, 0))

const { page, pageSize, paged, total, totalPages, rangeStart, rangeEnd, reset } = usePagination(
  computed(() => expenses.value || []),
  10
)
watch(query, reset, { deep: true })

function catName(key) {
  return categoryNameOf(categories.value, key)
}

const showForm = ref(false)
const showCategories = ref(false)
const showTechnicians = ref(false)
const editing = ref(null)
const form = ref({})
const errorMsg = ref('')
const categoryForm = ref({ name: '' })
const categoryError = ref('')
const savingCategory = ref(false)

function openAdd() {
  editing.value = null
  form.value = {
    date: todayStr(),
    category: 'material',
    description: '',
    amount: 0,
    relatedProductId: '',
    technicianId: ''
  }
  errorMsg.value = ''
  showForm.value = true
}
function openEdit(e) {
  editing.value = e
  form.value = {
    ...e,
    relatedProductId: e.relatedProductId || '',
    technicianId: e.technicianId != null ? String(e.technicianId) : ''
  }
  errorMsg.value = ''
  showForm.value = true
}
function openTechnicians() {
  showTechnicians.value = true
}
function closeTechnicians() {
  showTechnicians.value = false
  refreshTechnicians()
}

function onExpenseTechnician() {
  const t = (technicians.value || []).find((x) => String(x.id) === String(form.value.technicianId))
  if (!t) return
  if (!form.value.description || /^Upah /.test(form.value.description)) {
    form.value.description = `Upah ${t.name}`
  }
  if (!editing.value && (form.value.category === 'material' || form.value.category === 'technician')) {
    form.value.category = 'technician'
  }
}

async function onTechnicianCreated(created) {
  await refreshTechnicians()
  if (created?.id != null) {
    form.value.technicianId = String(created.id)
    onExpenseTechnician()
  }
}

function openCategories() {
  categoryForm.value = { name: '' }
  categoryError.value = ''
  showCategories.value = true
}
async function saveCategory() {
  categoryError.value = ''
  savingCategory.value = true
  try {
    const created = await $fetch('/api/expense-categories', { method: 'POST', body: categoryForm.value })
    await refreshCategories()
    form.value.category = created.key
    categoryForm.value = { name: '' }
    useToast().success(`Kategori "${created.name}" ditambahkan.`)
  } catch (e) {
    categoryError.value = e.data?.statusMessage || 'Gagal menambah kategori'
  } finally {
    savingCategory.value = false
  }
}
async function removeCategory(c) {
  if (!(await useConfirm().confirm(`Hapus kategori "${c.name}"?`))) return
  try {
    await $fetch(`/api/expense-categories/${c.id}`, { method: 'DELETE' })
    await refreshCategories()
    if (form.value.category === c.key) form.value.category = 'other'
  } catch (e) {
    useToast().error(e.data?.statusMessage || 'Gagal menghapus')
  }
}
async function save() {
  errorMsg.value = ''
  try {
    if (editing.value) {
      await $fetch(`/api/expenses/${editing.value.id}`, { method: 'PUT', body: form.value })
    } else {
      await $fetch('/api/expenses', { method: 'POST', body: form.value })
    }
    showForm.value = false
    await refresh()
  } catch (e) {
    errorMsg.value = e.data?.statusMessage || 'Gagal menyimpan'
  }
}
async function remove(e) {
  if (!(await useConfirm().confirm('Hapus pengeluaran ini?'))) return
  await $fetch(`/api/expenses/${e.id}`, { method: 'DELETE' })
  await refresh()
}
</script>

<template>
  <div class="space-y-4">
    <div class="flex items-center justify-between gap-2">
      <h1 class="text-xl font-bold">Pengeluaran</h1>
      <button class="btn-primary" @click="openAdd">
        <PlusIcon class="w-4 h-4" /><span class="hidden sm:inline">Catat Pengeluaran</span><span class="sm:hidden">Catat</span>
      </button>
    </div>
    <p class="text-xs text-ink-500">
      Pembelian perlengkapan ke toko sebaiknya dicatat lewat tombol <strong>Beli</strong> di
      <NuxtLink to="/materials" class="text-accent-600 hover:underline">Perlengkapan</NuxtLink>
      atau menu <NuxtLink to="/purchases" class="text-accent-600 hover:underline">Pembelian</NuxtLink>
      agar stok dan kas ikut. Upah teknisi: pilih nama dari daftar, kategori <strong>Upah teknisi</strong>.
      Halaman ini juga untuk pengeluaran lain (listrik, bensin).
    </p>

    <!-- Filter -->
    <div class="panel p-3 space-y-2 overflow-hidden">
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 min-w-0">
        <div class="min-w-0">
          <label class="label">Kategori</label>
          <select v-model="filters.category" class="input w-full min-w-0">
            <option value="">Semua</option>
            <option v-for="c in categories" :key="c.key" :value="c.key">{{ c.name }}</option>
          </select>
        </div>
        <div class="min-w-0">
          <label class="label">Proyek</label>
          <select v-model="filters.productId" class="input w-full min-w-0">
            <option value="">Semua</option>
            <option v-for="p in products" :key="p.id" :value="p.id">{{ p.name }}</option>
          </select>
        </div>
      </div>
      <div class="date-range">
        <div class="date-field">
          <label class="label">Dari</label>
          <input v-model="filters.dateFrom" type="date" class="input" />
        </div>
        <div class="date-field">
          <label class="label">Sampai</label>
          <input v-model="filters.dateTo" type="date" class="input" />
        </div>
      </div>
    </div>

    <div class="panel p-3 flex items-center justify-between md:hidden">
      <span class="text-xs uppercase font-semibold text-ink-500">Total {{ total }} entri</span>
      <span class="font-mono font-semibold text-red-600">{{ formatIDR(grandTotal) }}</span>
    </div>

    <!-- Kartu (mobile) -->
    <div class="md:hidden space-y-2">
      <div v-for="e in paged" :key="e.id" class="panel p-3 space-y-1">
        <div class="flex items-start justify-between gap-2">
          <span class="font-medium break-words">{{ e.description }}</span>
          <span class="font-mono font-semibold shrink-0">{{ formatIDR(e.amount) }}</span>
        </div>
        <div class="flex items-center gap-2 flex-wrap">
          <span class="badge" :class="categoryBadgeClass(e.category)">{{ e.categoryName || catName(e.category) }}</span>
          <span class="font-mono text-xs text-ink-500">{{ formatDate(e.date) }}</span>
        </div>
        <div v-if="e.productName" class="text-xs text-ink-400">Item: {{ e.productName }}</div>
        <p v-if="e.fromMachine" class="text-xs text-ink-400">Dari halaman Peralatan — ubah di sana.</p>
        <div v-if="!e.fromMachine" class="btn-actions pt-1">
          <button class="btn-action" @click="openEdit(e)"><PencilSquareIcon class="w-3.5 h-3.5" />Edit</button>
          <button class="btn-action-danger" @click="remove(e)"><TrashIcon class="w-3.5 h-3.5" />Hapus</button>
        </div>
      </div>
      <p v-if="!total" class="panel p-6 text-center text-sm text-ink-500">Tidak ada pengeluaran.</p>
      <div v-else class="panel">
        <AppPagination
          v-model:page="page"
          v-model:pageSize="pageSize"
          :total-pages="totalPages"
          :total="total"
          :range-start="rangeStart"
          :range-end="rangeEnd"
        />
      </div>
    </div>

    <div class="panel hidden md:block">
      <div class="overflow-x-auto">
        <table class="table-std">
          <thead>
            <tr>
              <th>Tanggal</th>
              <th>Kategori</th>
              <th>Deskripsi</th>
              <th>Item terkait</th>
              <th class="text-right">Jumlah</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="e in paged" :key="e.id">
              <td class="whitespace-nowrap font-mono text-xs">{{ formatDate(e.date) }}</td>
              <td><span class="badge" :class="categoryBadgeClass(e.category)">{{ e.categoryName || catName(e.category) }}</span></td>
              <td>{{ e.description }}</td>
              <td class="text-ink-500">{{ e.productName || '-' }}</td>
              <td class="num">{{ formatIDR(e.amount) }}</td>
              <td class="whitespace-nowrap text-right">
                <template v-if="e.fromMachine">
                  <span class="text-xs text-ink-400">Dari Peralatan</span>
                </template>
                <template v-else>
                  <div class="btn-actions justify-end">
                    <button class="btn-action" @click="openEdit(e)"><PencilSquareIcon class="w-3.5 h-3.5" />Edit</button>
                    <button class="btn-action-danger" @click="remove(e)"><TrashIcon class="w-3.5 h-3.5" />Hapus</button>
                  </div>
                </template>
              </td>
            </tr>
            <tr v-if="!total">
              <td colspan="6" class="text-center text-ink-500 py-6">Tidak ada pengeluaran.</td>
            </tr>
          </tbody>
          <tfoot v-if="total">
            <tr class="font-semibold bg-ink-50">
              <td colspan="4" class="px-3 py-2">Total keseluruhan ({{ total }} entri)</td>
              <td class="num px-3 py-2 text-red-600">{{ formatIDR(grandTotal) }}</td>
              <td></td>
            </tr>
          </tfoot>
        </table>
      </div>
      <AppPagination
        v-model:page="page"
        v-model:pageSize="pageSize"
        :total-pages="totalPages"
        :total="total"
        :range-start="rangeStart"
        :range-end="rangeEnd"
      />
    </div>

    <AppModal v-if="showForm" :title="editing ? 'Edit Pengeluaran' : 'Catat Pengeluaran'" @close="showForm = false">
      <form class="space-y-3" @submit.prevent="save">
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div class="date-field">
            <label class="label">Tanggal</label>
            <input v-model="form.date" type="date" class="input" required />
          </div>
          <div class="min-w-0">
            <label class="label">Kategori</label>
            <div class="flex gap-2 min-w-0">
              <select v-model="form.category" class="input min-w-0" required>
                <option v-for="c in categories" :key="c.key" :value="c.key">{{ c.name }}</option>
              </select>
              <button type="button" class="btn-secondary shrink-0" title="Kelola kategori" @click="openCategories">
                <PlusIcon class="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
        <div>
          <label class="label">Teknisi (opsional)</label>
          <div class="flex gap-2 min-w-0">
            <select v-model="form.technicianId" class="input min-w-0" @change="onExpenseTechnician">
              <option value="">—</option>
              <option v-for="t in technicians" :key="t.id" :value="String(t.id)">{{ t.name }}</option>
            </select>
            <button type="button" class="btn-secondary shrink-0" title="Kelola teknisi" @click="openTechnicians">
              <PlusIcon class="w-4 h-4" />
            </button>
          </div>
        </div>
        <div>
          <label class="label">Deskripsi</label>
          <input v-model="form.description" class="input" required placeholder="Upah Andi / Beli PLA 2 roll" />
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="label">Jumlah</label>
            <IdrInput v-model="form.amount" required />
          </div>
          <div>
            <label class="label">Proyek terkait (opsional)</label>
            <select v-model="form.relatedProductId" class="input">
              <option value="">—</option>
              <option v-for="p in products" :key="p.id" :value="p.id">{{ p.name }}</option>
            </select>
            <p class="text-xs text-ink-400 mt-1">Untuk R&amp;D / alokasi ke proyek. Pembelian supplier menampilkan barang yang dibeli.</p>
          </div>
        </div>
        <p v-if="errorMsg" class="text-sm text-red-600">{{ errorMsg }}</p>
        <div class="flex justify-end gap-2 pt-2">
          <button type="button" class="btn-secondary" @click="showForm = false"><XMarkIcon class="w-4 h-4" />Batal</button>
          <button type="submit" class="btn-primary"><CheckIcon class="w-4 h-4" />Simpan</button>
        </div>
      </form>
    </AppModal>

    <TechnicianManageModal
      v-if="showTechnicians"
      nested
      @close="closeTechnicians"
      @created="onTechnicianCreated"
      @changed="refreshTechnicians"
    />

    <AppModal v-if="showCategories" title="Kategori Pengeluaran" nested @close="showCategories = false">
      <div class="space-y-4">
        <form class="space-y-3" @submit.prevent="saveCategory">
          <div>
            <label class="label">Nama kategori baru</label>
            <input v-model="categoryForm.name" class="input" required placeholder="Produk / Iklan / Ongkir" />
          </div>
          <p v-if="categoryError" class="text-sm text-red-600">{{ categoryError }}</p>
          <div class="flex justify-end">
            <button type="submit" class="btn-primary" :disabled="savingCategory">
              <CheckIcon class="w-4 h-4" />{{ savingCategory ? 'Menyimpan…' : 'Tambah' }}
            </button>
          </div>
        </form>
        <div>
          <div class="label">Daftar kategori</div>
          <ul v-if="categories?.length" class="border border-ink-200 rounded-panel divide-y divide-ink-100 max-h-56 overflow-y-auto">
            <li v-for="c in categories" :key="c.id" class="flex items-center gap-2 px-3 py-2">
              <span class="badge" :class="categoryBadgeClass(c.key)">{{ c.name }}</span>
              <span v-if="c.isSystem" class="text-xs text-ink-400">bawaan</span>
              <button
                v-if="!c.isSystem"
                type="button"
                class="btn-action-danger ml-auto"
                @click="removeCategory(c)"
              >
                <TrashIcon class="w-3.5 h-3.5" />
              </button>
            </li>
          </ul>
        </div>
      </div>
    </AppModal>
  </div>
</template>
