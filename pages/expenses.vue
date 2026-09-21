<script setup>
import { PlusIcon, PencilSquareIcon, TrashIcon, CheckIcon, XMarkIcon } from '@heroicons/vue/24/outline'
import { categoryBadgeProps, categoryColorFromList, categoryNameOf } from '~/utils/expenseCategory.js'
import { technicianPayStatus } from '~/utils/technicianPortal.js'

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
function catBadge(key, color) {
  return categoryBadgeProps(key, color || categoryColorFromList(categories.value, key))
}

const showForm = ref(false)
const showCategories = ref(false)
const showTechnicians = ref(false)
const editing = ref(null)
const form = ref({})
const errorMsg = ref('')
const saving = ref(false)
const categoryForm = ref({ name: '' })
const categoryError = ref('')
const savingCategory = ref(false)
const technicianWork = ref(null)
const loadingTechnicianWork = ref(false)
const selectedWageIds = ref([])

function isTechnicianExpense() {
  return form.value.category === 'technician'
}
function isWageCreate() {
  return isTechnicianExpense() && !editing.value
}
const wageProjects = computed(() => technicianWork.value?.projects || [])
const unpaidWageProjects = computed(() => wageProjects.value.filter((p) => p.unpaidAmount > 0))
const selectedWageTotal = computed(() =>
  wageProjects.value
    .filter((p) => selectedWageIds.value.includes(p.id))
    .reduce((sum, p) => sum + (p.unpaidAmount || 0), 0)
)
const allUnpaidSelected = computed(
  () =>
    unpaidWageProjects.value.length > 0 &&
    unpaidWageProjects.value.every((p) => selectedWageIds.value.includes(p.id))
)

function isWageSelected(id) {
  return selectedWageIds.value.includes(id)
}
function toggleWage(project) {
  if (!project?.unpaidAmount) return
  if (isWageSelected(project.id)) {
    selectedWageIds.value = selectedWageIds.value.filter((id) => id !== project.id)
  } else {
    selectedWageIds.value = [...selectedWageIds.value, project.id]
  }
}
function toggleAllUnpaidWages() {
  if (allUnpaidSelected.value) selectedWageIds.value = []
  else selectedWageIds.value = unpaidWageProjects.value.map((p) => p.id)
}

async function loadTechnicianProjects() {
  const technicianId = form.value.technicianId
  if (!isWageCreate() || !technicianId) {
    technicianWork.value = null
    selectedWageIds.value = []
    return
  }
  loadingTechnicianWork.value = true
  try {
    technicianWork.value = await $fetch(`/api/technicians/${technicianId}/work`)
    selectedWageIds.value = []
  } catch {
    technicianWork.value = null
    selectedWageIds.value = []
  } finally {
    loadingTechnicianWork.value = false
  }
}

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
  technicianWork.value = null
  selectedWageIds.value = []
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
  technicianWork.value = null
  selectedWageIds.value = []
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
  if (form.value.technicianId && !editing.value) form.value.category = 'technician'
  loadTechnicianProjects()
}

function onExpenseCategoryChange() {
  if (!isWageCreate()) {
    technicianWork.value = null
    selectedWageIds.value = []
    return
  }
  loadTechnicianProjects()
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
  saving.value = true
  try {
    if (isWageCreate()) {
      if (!form.value.technicianId) {
        errorMsg.value = 'Pilih teknisi'
        return
      }
      if (!selectedWageIds.value.length) {
        errorMsg.value = 'Centang minimal satu proyek'
        return
      }
      const result = await $fetch('/api/expenses/technician-wages', {
        method: 'POST',
        body: {
          date: form.value.date,
          technicianId: form.value.technicianId,
          productIds: selectedWageIds.value
        }
      })
      useToast().success(`Tersimpan ${result.count} upah teknisi.`)
    } else if (editing.value) {
      await $fetch(`/api/expenses/${editing.value.id}`, { method: 'PUT', body: form.value })
    } else {
      await $fetch('/api/expenses', { method: 'POST', body: form.value })
    }
    showForm.value = false
    await refresh()
  } catch (e) {
    errorMsg.value = e.data?.statusMessage || 'Gagal menyimpan'
  } finally {
    saving.value = false
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
      <h1 class="text-xl font-bold inline-flex items-center gap-1.5">
        Pengeluaran
        <InfoHint label="Keterangan pengeluaran">
          <p>
            Pembelian perlengkapan ke toko sebaiknya dicatat lewat tombol <strong>Beli</strong> di
            <NuxtLink to="/materials" class="text-accent-600 hover:underline">Perlengkapan</NuxtLink>
            atau menu <NuxtLink to="/purchases" class="text-accent-600 hover:underline">Pembelian</NuxtLink>
            agar stok dan kas ikut.
          </p>
          <p>Upah teknisi: pilih teknisi, centang proyek yang upahnya dibayar, lalu simpan.</p>
          <p>Halaman ini juga untuk pengeluaran lain (listrik, bensin).</p>
        </InfoHint>
      </h1>
      <button class="btn-primary" @click="openAdd">
        <PlusIcon class="w-4 h-4" /><span class="hidden sm:inline">Catat Pengeluaran</span><span class="sm:hidden">Catat</span>
      </button>
    </div>

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
          <span v-bind="catBadge(e.category, e.categoryColor)">{{ e.categoryName || catName(e.category) }}</span>
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
              <th class="min-w-[10rem]">Kategori</th>
              <th>Deskripsi</th>
              <th>Item terkait</th>
              <th class="text-right">Jumlah</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="e in paged" :key="e.id">
              <td class="whitespace-nowrap font-mono text-xs">{{ formatDate(e.date) }}</td>
              <td class="min-w-[10rem] whitespace-nowrap">
                <span v-bind="catBadge(e.category, e.categoryColor)">{{ e.categoryName || catName(e.category) }}</span>
              </td>
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

    <AppModal
      v-if="showForm"
      :title="editing ? 'Edit Pengeluaran' : 'Catat Pengeluaran'"
      :size="isWageCreate() ? 'lg' : 'md'"
      @close="showForm = false"
    >
      <form class="space-y-3" @submit.prevent="save">
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div class="date-field">
            <label class="label">Tanggal</label>
            <input v-model="form.date" type="date" class="input" required />
          </div>
          <div class="min-w-0">
            <label class="label">Kategori</label>
            <div class="flex gap-2 min-w-0">
              <select v-model="form.category" class="input min-w-0" required @change="onExpenseCategoryChange">
                <option v-for="c in categories" :key="c.key" :value="c.key">{{ c.name }}</option>
              </select>
              <button type="button" class="btn-secondary shrink-0" title="Kelola kategori" @click="openCategories">
                <PlusIcon class="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
        <div>
          <label class="label">{{ isTechnicianExpense() ? 'Teknisi' : 'Teknisi (opsional)' }}</label>
          <div class="flex gap-2 min-w-0">
            <select
              v-model="form.technicianId"
              class="input min-w-0"
              :required="isTechnicianExpense()"
              @change="onExpenseTechnician"
            >
              <option value="">—</option>
              <option v-for="t in technicians" :key="t.id" :value="String(t.id)">{{ t.name }}</option>
            </select>
            <button type="button" class="btn-secondary shrink-0" title="Kelola teknisi" @click="openTechnicians">
              <PlusIcon class="w-4 h-4" />
            </button>
          </div>
        </div>

        <template v-if="isWageCreate()">
          <div class="rounded-panel border border-emerald-200 bg-emerald-50/60 px-3 py-2.5 space-y-2">
            <div class="flex items-center justify-between gap-2">
              <div class="text-xs font-semibold text-emerald-900">Proyek & upah teknisi</div>
              <button
                v-if="unpaidWageProjects.length"
                type="button"
                class="text-xs font-medium text-emerald-800 hover:underline"
                @click="toggleAllUnpaidWages"
              >
                {{ allUnpaidSelected ? 'Batal semua' : 'Pilih yang belum dibayar' }}
              </button>
            </div>
            <p v-if="!form.technicianId" class="text-xs text-emerald-800/80">Pilih teknisi untuk melihat proyeknya.</p>
            <p v-else-if="loadingTechnicianWork" class="text-xs text-emerald-800/80">Memuat proyek…</p>
            <p v-else-if="!wageProjects.length" class="text-xs text-emerald-800/80">
              Teknisi ini belum tercatat di pembagian upah proyek.
            </p>
            <div v-else class="overflow-x-auto -mx-1">
              <table class="table-std text-sm bg-white rounded-panel">
                <thead>
                  <tr>
                    <th class="w-10">
                      <input
                        type="checkbox"
                        class="h-4 w-4 accent-accent-600"
                        :checked="allUnpaidSelected"
                        :disabled="!unpaidWageProjects.length"
                        @change="toggleAllUnpaidWages"
                      />
                    </th>
                    <th>Proyek</th>
                    <th class="text-right">Upah</th>
                    <th class="text-right">Dibayar</th>
                    <th class="text-right">Sisa</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  <tr
                    v-for="p in wageProjects"
                    :key="p.id"
                    :class="p.unpaidAmount > 0 ? 'cursor-pointer hover:bg-ink-50' : 'opacity-60'"
                    @click="toggleWage(p)"
                  >
                    <td @click.stop>
                      <input
                        type="checkbox"
                        class="h-4 w-4 accent-accent-600"
                        :checked="isWageSelected(p.id)"
                        :disabled="p.unpaidAmount <= 0"
                        @change="toggleWage(p)"
                      />
                    </td>
                    <td>
                      <div class="font-medium">{{ p.name }}</div>
                      <div v-if="p.customerName" class="text-xs text-ink-500">{{ p.customerName }}</div>
                    </td>
                    <td class="num">{{ formatIDR(p.wageAmount) }}</td>
                    <td class="num">{{ formatIDR(p.paidAmount) }}</td>
                    <td class="num">{{ formatIDR(p.unpaidAmount) }}</td>
                    <td>
                      <span class="badge" :class="technicianPayStatus(p).class">{{ technicianPayStatus(p).label }}</span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p class="text-xs text-emerald-900 font-medium">
              Dipilih {{ selectedWageIds.length }} proyek · total {{ formatIDR(selectedWageTotal) }}
            </p>
          </div>
        </template>

        <template v-else>
          <div>
            <label class="label">Deskripsi</label>
            <input v-model="form.description" class="input" required placeholder="Upah Andi / Beli PLA 2 roll" />
          </div>
          <div>
            <label class="label">Proyek terkait (opsional)</label>
            <select v-model="form.relatedProductId" class="input">
              <option value="">—</option>
              <option v-for="p in products" :key="p.id" :value="p.id">{{ p.name }}</option>
            </select>
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="label">Jumlah</label>
              <IdrInput v-model="form.amount" required />
            </div>
          </div>
        </template>

        <p v-if="errorMsg" class="text-sm text-red-600">{{ errorMsg }}</p>
        <div class="flex justify-end gap-2 pt-2">
          <button type="button" class="btn-secondary" @click="showForm = false"><XMarkIcon class="w-4 h-4" />Batal</button>
          <button type="submit" class="btn-primary" :disabled="saving">
            <CheckIcon class="w-4 h-4" />{{ saving ? 'Menyimpan…' : 'Simpan' }}
          </button>
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
              <span v-bind="catBadge(c.key, c.color)">{{ c.name }}</span>
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
