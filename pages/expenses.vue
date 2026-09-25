<script setup>
import { PlusIcon, PencilSquareIcon, TrashIcon, CheckIcon, XMarkIcon } from '@heroicons/vue/24/outline'
import { categoryBadgeProps, categoryColorFromList, categoryNameOf } from '~/utils/expenseCategory.js'
import { technicianPayStatus } from '~/utils/technicianPortal.js'
import { isPersonalCategory, personalCapitalShortfall } from '~/utils/personalExpense.js'

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
const wagePayouts = ref({})
const personalDraw = ref(null)
const loadingPersonalDraw = ref(false)

function isTechnicianExpense() {
  return form.value.category === 'technician'
}
function isWageCreate() {
  return isTechnicianExpense() && !editing.value
}
const selectedCategory = computed(() => (categories.value || []).find((c) => c.key === form.value.category))
const formKind = computed(() => {
  if (isPersonalCategory({ key: form.value.category, name: selectedCategory.value?.name })) return 'personal'
  switch (form.value.category) {
    case 'technician':
      return 'technician'
    case 'material':
    case 'packaging':
      return 'stock'
    case 'machine':
      return 'asset'
    case 'electricity':
      return 'utility'
    case 'tool':
      return 'tool'
    case 'rnd':
      return 'rnd'
    default:
      return 'general'
  }
})
const formTitle = computed(() => {
  if (editing.value) return 'Edit Pengeluaran'
  if (formKind.value === 'personal') return 'Catat Pengeluaran Pribadi'
  const titles = {
    technician: 'Catat Upah Teknisi',
    material: 'Catat Perlengkapan',
    packaging: 'Catat Produk',
    machine: 'Catat Peralatan',
    electricity: 'Catat Listrik',
    tool: 'Catat Alat',
    rnd: 'Catat R&D',
    other: 'Catat Pengeluaran'
  }
  return titles[form.value.category] || 'Catat Pengeluaran'
})
const descriptionPlaceholder = computed(() => {
  if (formKind.value === 'personal') return 'Makan, bensin pribadi, belanja rumah…'
  const placeholders = {
    electricity: 'Token listrik / tagihan PLN',
    tool: 'Tang, bor, konektor…',
    rnd: 'Uji coba / sampel / riset',
    material: 'Beli kabel / conduit (stok tidak bertambah)',
    packaging: 'Beli kamera / NVR (stok tidak bertambah)',
    machine: 'Beli alat (tanpa masuk daftar aset)',
    other: 'Bensin, ongkir, sewa…',
    technician: 'Upah teknisi'
  }
  return placeholders[form.value.category] || 'Keterangan pengeluaran'
})
const showProjectField = computed(() => {
  if (isWageCreate()) return false
  return ['stock', 'tool', 'rnd', 'general', 'technician'].includes(formKind.value)
})
const kindPanelClass = computed(() => {
  const map = {
    technician: 'border-emerald-200 bg-emerald-50/60',
    stock: 'border-teal-200 bg-teal-50/70',
    asset: 'border-slate-200 bg-slate-50',
    utility: 'border-amber-200 bg-amber-50/70',
    tool: 'border-stone-200 bg-stone-50',
    rnd: 'border-purple-200 bg-purple-50/70',
    personal: 'border-rose-200 bg-rose-50/70',
    general: 'border-ink-200 bg-ink-50/80'
  }
  return map[formKind.value] || map.general
})
const kindTitleClass = computed(() => {
  const map = {
    technician: 'text-emerald-900',
    stock: 'text-teal-900',
    asset: 'text-slate-800',
    utility: 'text-amber-900',
    tool: 'text-stone-800',
    rnd: 'text-purple-900',
    personal: 'text-rose-900',
    general: 'text-ink-800'
  }
  return map[formKind.value] || map.general
})
const kindBodyClass = computed(() => {
  const map = {
    technician: 'text-emerald-800/80',
    stock: 'text-teal-800/80',
    asset: 'text-slate-600',
    utility: 'text-amber-800/80',
    tool: 'text-stone-600',
    rnd: 'text-purple-800/80',
    personal: 'text-rose-800/80',
    general: 'text-ink-500'
  }
  return map[formKind.value] || map.general
})
const personalRemaining = computed(() => {
  const remaining = Number(personalDraw.value?.remaining) || 0
  const current = editing.value && isPersonalCategory({ key: editing.value.category })
    ? Number(editing.value.amount) || 0
    : 0
  return remaining + current
})
const personalShortfall = computed(() => personalCapitalShortfall(form.value.amount, personalRemaining.value))
const wageProjects = computed(() => technicianWork.value?.projects || [])
const unpaidWageProjects = computed(() => wageProjects.value.filter((p) => p.unpaidAmount > 0))
const selectedWageTotal = computed(() =>
  selectedWageIds.value.reduce((sum, id) => sum + Math.max(Math.round(Number(wagePayouts.value[id]) || 0), 0), 0)
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
    const next = { ...wagePayouts.value }
    delete next[project.id]
    wagePayouts.value = next
  } else {
    selectedWageIds.value = [...selectedWageIds.value, project.id]
    wagePayouts.value = { ...wagePayouts.value, [project.id]: project.unpaidAmount }
  }
}
function toggleAllUnpaidWages() {
  if (allUnpaidSelected.value) {
    selectedWageIds.value = []
    wagePayouts.value = {}
    return
  }
  selectedWageIds.value = unpaidWageProjects.value.map((p) => p.id)
  wagePayouts.value = Object.fromEntries(unpaidWageProjects.value.map((p) => [p.id, p.unpaidAmount]))
}
function setWagePayout(project, amount) {
  const max = Math.max(Math.round(Number(project.unpaidAmount) || 0), 0)
  wagePayouts.value = {
    ...wagePayouts.value,
    [project.id]: Math.min(Math.max(Math.round(Number(amount) || 0), 0), max)
  }
}

async function loadTechnicianProjects() {
  const technicianId = form.value.technicianId
  if (!isWageCreate() || !technicianId) {
    technicianWork.value = null
    selectedWageIds.value = []
    wagePayouts.value = {}
    return
  }
  loadingTechnicianWork.value = true
  try {
    technicianWork.value = await $fetch(`/api/technicians/${technicianId}/work`)
    selectedWageIds.value = []
    wagePayouts.value = {}
  } catch {
    technicianWork.value = null
    selectedWageIds.value = []
    wagePayouts.value = {}
  } finally {
    loadingTechnicianWork.value = false
  }
}

async function loadPersonalDraw() {
  if (formKind.value !== 'personal') {
    personalDraw.value = null
    return
  }
  loadingPersonalDraw.value = true
  try {
    personalDraw.value = await $fetch('/api/expenses/personal-draw')
    if (personalDraw.value?.technician?.id) {
      form.value.technicianId = String(personalDraw.value.technician.id)
    }
  } catch {
    personalDraw.value = null
  } finally {
    loadingPersonalDraw.value = false
  }
}

function openAdd() {
  editing.value = null
  form.value = {
    date: todayStr(),
    category: 'other',
    description: '',
    amount: 0,
    relatedProductId: '',
    technicianId: ''
  }
  technicianWork.value = null
  selectedWageIds.value = []
  wagePayouts.value = {}
  personalDraw.value = null
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
  wagePayouts.value = {}
  personalDraw.value = null
  errorMsg.value = ''
  showForm.value = true
  loadPersonalDraw()
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
  if (formKind.value === 'personal') {
    technicianWork.value = null
    selectedWageIds.value = []
    wagePayouts.value = {}
    form.value.relatedProductId = ''
    loadPersonalDraw()
    return
  }
  personalDraw.value = null
  if (!isTechnicianExpense()) {
    form.value.technicianId = ''
    technicianWork.value = null
    selectedWageIds.value = []
    wagePayouts.value = {}
  } else {
    loadTechnicianProjects()
  }
  if (!showProjectField.value) form.value.relatedProductId = ''
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
    onExpenseCategoryChange()
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
      const lines = selectedWageIds.value.map((id) => ({
        productId: id,
        amount: Math.max(Math.round(Number(wagePayouts.value[id]) || 0), 0)
      }))
      if (lines.some((line) => line.amount <= 0)) {
        errorMsg.value = 'Isi nominal yang diambil untuk setiap proyek yang dipilih'
        return
      }
      const result = await $fetch('/api/expenses/technician-wages', {
        method: 'POST',
        body: {
          date: form.value.date,
          technicianId: form.value.technicianId,
          lines
        }
      })
      useToast().success(`Tersimpan ${result.count} upah teknisi.`)
    } else {
      if (formKind.value === 'personal' && personalDraw.value?.technician?.id) {
        form.value.technicianId = String(personalDraw.value.technician.id)
        form.value.relatedProductId = ''
      }
      const saved = editing.value
        ? await $fetch(`/api/expenses/${editing.value.id}`, { method: 'PUT', body: form.value })
        : await $fetch('/api/expenses', { method: 'POST', body: form.value })
      if (saved?.capitalWithdrawal?.amount) {
        useToast().success(`Tersimpan. Penarikan modal ${formatIDR(saved.capitalWithdrawal.amount)}.`)
      }
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
          <p>Form menyesuaikan kategori: upah teknisi (centang proyek, boleh diambil sebagian), pribadi dari gabungan upah Pande, stok lewat Pembelian, aset lewat Peralatan, listrik/alat/R&D punya field sendiri.</p>
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
      :title="formTitle"
      size="lg"
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

        <div v-if="isTechnicianExpense()">
          <label class="label">Teknisi</label>
          <div class="flex gap-2 min-w-0">
            <select
              v-model="form.technicianId"
              class="input min-w-0"
              required
              @change="onExpenseTechnician"
            >
              <option value="">Pilih teknisi</option>
              <option v-for="t in technicians" :key="t.id" :value="String(t.id)">{{ t.name }}</option>
            </select>
            <button type="button" class="btn-secondary shrink-0" title="Kelola teknisi" @click="openTechnicians">
              <PlusIcon class="w-4 h-4" />
            </button>
          </div>
        </div>

        <template v-if="isWageCreate()">
          <div class="rounded-panel border px-3 py-2.5 space-y-2" :class="kindPanelClass">
            <div class="flex items-center justify-between gap-2">
              <div class="text-xs font-semibold" :class="kindTitleClass">Proyek & upah teknisi</div>
              <button
                v-if="unpaidWageProjects.length"
                type="button"
                class="text-xs font-medium text-emerald-800 hover:underline"
                @click="toggleAllUnpaidWages"
              >
                {{ allUnpaidSelected ? 'Batal semua' : 'Pilih yang belum dibayar' }}
              </button>
            </div>
            <p v-if="!form.technicianId" class="text-xs" :class="kindBodyClass">Pilih teknisi untuk melihat proyeknya.</p>
            <p v-else-if="loadingTechnicianWork" class="text-xs" :class="kindBodyClass">Memuat proyek…</p>
            <p v-else-if="!wageProjects.length" class="text-xs" :class="kindBodyClass">
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
                    <th class="text-right">Diambil</th>
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
                    <td class="min-w-[8.5rem]" @click.stop>
                      <IdrInput
                        v-if="isWageSelected(p.id)"
                        :model-value="wagePayouts[p.id] || 0"
                        input-class="w-full text-right"
                        :min="0"
                        @update:model-value="setWagePayout(p, $event)"
                      />
                      <span v-else class="text-ink-400">—</span>
                    </td>
                    <td>
                      <span class="badge" :class="technicianPayStatus(p).class">{{ technicianPayStatus(p).label }}</span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p class="text-xs" :class="kindBodyClass">
              Bisa diambil sebagian. Sisa tetap belum dibayar.
            </p>
            <p class="text-xs font-medium" :class="kindTitleClass">
              Dipilih {{ selectedWageIds.length }} proyek · diambil {{ formatIDR(selectedWageTotal) }}
            </p>
          </div>
        </template>

        <template v-else-if="formKind === 'personal'">
          <div class="rounded-panel border px-3 py-2.5 space-y-2" :class="kindPanelClass">
            <p v-if="loadingPersonalDraw" class="text-xs" :class="kindBodyClass">Memuat upah Pande…</p>
            <p v-else-if="!personalDraw?.technician" class="text-xs" :class="kindBodyClass">
              Teknisi bernama Pande belum ada. Tambahkan di daftar teknisi supaya total upah muncul di sini.
            </p>
            <template v-else>
              <div class="grid grid-cols-3 gap-2">
                <div class="rounded-panel bg-white px-2 py-2">
                  <div class="text-[10px] uppercase tracking-wide text-ink-400">Total upah</div>
                  <div class="font-mono text-sm font-semibold">{{ formatIDR(personalDraw.wageTotal) }}</div>
                </div>
                <div class="rounded-panel bg-white px-2 py-2">
                  <div class="text-[10px] uppercase tracking-wide text-ink-400">Sudah dipakai</div>
                  <div class="font-mono text-sm font-semibold">{{ formatIDR(personalDraw.personalSpent) }}</div>
                </div>
                <div class="rounded-panel bg-white px-2 py-2">
                  <div class="text-[10px] uppercase tracking-wide text-ink-400">Sisa</div>
                  <div
                    class="font-mono text-sm font-semibold"
                    :class="personalRemaining < 0 ? 'text-red-600' : 'text-rose-800'"
                  >
                    {{ formatIDR(personalRemaining) }}
                  </div>
                </div>
              </div>
              <p class="text-xs" :class="kindBodyClass">
                {{ personalDraw.projectCount }} proyek · {{ personalDraw.technician.name }}
              </p>
              <div v-if="personalDraw.projects.length" class="overflow-x-auto -mx-1">
                <table class="table-std text-sm bg-white rounded-panel">
                  <thead>
                    <tr>
                      <th>Proyek</th>
                      <th class="text-right">Upah</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="p in personalDraw.projects" :key="p.id">
                      <td class="font-medium">{{ p.name }}</td>
                      <td class="num">{{ formatIDR(p.wageAmount) }}</td>
                    </tr>
                  </tbody>
                  <tfoot>
                    <tr class="font-semibold bg-rose-50/80">
                      <td class="px-3 py-2">Gabungan</td>
                      <td class="num px-3 py-2">{{ formatIDR(personalDraw.wageTotal) }}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </template>
          </div>

          <div>
            <label class="label">Deskripsi</label>
            <input v-model="form.description" class="input" required :placeholder="descriptionPlaceholder" />
          </div>
          <div>
            <label class="label">Jumlah</label>
            <IdrInput v-model="form.amount" required />
            <p v-if="personalDraw?.technician" class="text-xs text-ink-400 mt-1">
              Sisa sumber pribadi {{ formatIDR(personalRemaining) }}.
            </p>
            <p v-if="personalShortfall > 0" class="text-xs text-amber-800 mt-1">
              Selisih {{ formatIDR(personalShortfall) }} dicatat sebagai penarikan modal.
            </p>
          </div>
        </template>

        <template v-else>
          <div class="rounded-panel border px-3 py-2.5 space-y-2" :class="kindPanelClass">
            <div class="text-xs font-semibold" :class="kindTitleClass">
              {{
                formKind === 'stock'
                  ? 'Pembelian stok'
                  : formKind === 'asset'
                    ? 'Belanja aset peralatan'
                    : formKind === 'utility'
                      ? 'Listrik & utilitas'
                      : formKind === 'tool'
                        ? 'Alat & perkakas'
                        : formKind === 'rnd'
                          ? 'Riset & uji coba'
                          : formKind === 'technician'
                            ? 'Upah teknisi'
                            : formKind === 'personal'
                              ? 'Pengeluaran pribadi'
                              : 'Pengeluaran lain'
              }}
            </div>
            <p class="text-xs" :class="kindBodyClass">
              <template v-if="formKind === 'stock'">
                Beli ke toko sebaiknya lewat
                <NuxtLink to="/purchases" class="font-medium text-teal-800 hover:underline">Pembelian</NuxtLink>
                atau tombol Beli di
                <NuxtLink to="/materials" class="font-medium text-teal-800 hover:underline">Perlengkapan</NuxtLink>
                agar stok dan kas ikut.
              </template>
              <template v-else-if="formKind === 'asset'">
                Beli alat baru lewat
                <NuxtLink to="/machines" class="font-medium text-slate-800 hover:underline">Peralatan</NuxtLink>
                agar masuk aset. Di sini hanya memotong kas, tidak menambah daftar alat.
              </template>
              <template v-else-if="formKind === 'utility'">
                Tagihan listrik, token, atau utilitas workshop. Masuk biaya operasional.
              </template>
              <template v-else-if="formKind === 'tool'">
                Perkakas kecil atau bahan pasang habis pakai — bukan aset di menu Peralatan.
              </template>
              <template v-else-if="formKind === 'rnd'">
                Bisa untuk proyek tertentu atau riset umum tanpa proyek.
              </template>
              <template v-else-if="formKind === 'technician'">
                Ubah nominal atau proyek upah yang sudah tercatat.
              </template>
              <template v-else>
                Pengeluaran operasional lain (bensin, ongkir, sewa, dan kategori kustom).
              </template>
            </p>
            <div v-if="formKind === 'stock'" class="flex flex-wrap gap-2">
              <NuxtLink to="/purchases" class="btn-secondary text-xs" @click="showForm = false">Catat pembelian</NuxtLink>
              <NuxtLink to="/materials" class="btn-secondary text-xs" @click="showForm = false">Buka perlengkapan</NuxtLink>
            </div>
            <div v-else-if="formKind === 'asset'" class="flex flex-wrap gap-2">
              <NuxtLink to="/machines" class="btn-secondary text-xs" @click="showForm = false">Kelola peralatan</NuxtLink>
            </div>
          </div>

          <div>
            <label class="label">{{ formKind === 'utility' ? 'Keterangan tagihan' : 'Deskripsi' }}</label>
            <input v-model="form.description" class="input" required :placeholder="descriptionPlaceholder" />
          </div>
          <div v-if="showProjectField">
            <label class="label">Proyek terkait (opsional)</label>
            <select v-model="form.relatedProductId" class="input">
              <option value="">{{ formKind === 'rnd' ? 'Tanpa proyek' : '—' }}</option>
              <option v-for="p in products" :key="p.id" :value="p.id">{{ p.name }}</option>
            </select>
            <p v-if="formKind === 'rnd'" class="text-xs text-ink-400 mt-1">
              Kosongkan jika uji coba/sampel tidak terikat proyek.
            </p>
          </div>
          <div>
            <label class="label">Jumlah</label>
            <IdrInput v-model="form.amount" required />
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
