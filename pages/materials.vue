<script setup>
import {
  PlusIcon,
  PencilSquareIcon,
  TrashIcon,
  CheckIcon,
  XMarkIcon,
  MagnifyingGlassIcon,
  ShoppingCartIcon,
  ArrowsUpDownIcon
} from '@heroicons/vue/24/outline'

import {
  MATERIAL_UNITS,
  MATERIAL_BUY_UNITS,
  materialTypeLabel,
  materialTypeBadge,
  materialTypeOptions,
  stockStatusLabel,
  stockStatusBadge,
  materialNeedsRestock
} from '~/utils/materialType.js'
import {
  formatPurchaseConversion,
  purchasePriceOf,
  purchaseStockMultiplier,
  purchaseUnitOf,
  stockQtyFromPurchase
} from '~/utils/cableRoll.js'

const { data: materials, refresh } = await useFetch('/api/materials')
const { data: suppliers } = await useFetch('/api/suppliers')
const { data: projects } = await useFetch('/api/products')
const isAdmin = computed(() => useState('authUser').value?.role === 'admin')

const search = ref('')
const onlyRestock = ref(false)
const filteredMaterials = computed(() => {
  let rows = materials.value || []
  if (onlyRestock.value) rows = rows.filter(materialNeedsRestock)
  const q = search.value.trim().toLowerCase()
  if (q) {
    rows = rows.filter(
      (m) => m.name.toLowerCase().includes(q) || (m.supplier || '').toLowerCase().includes(q)
    )
  }
  return [...rows].sort((a, b) => {
    const rank = { empty: 0, low: 1, ok: 2 }
    const d = (rank[a.stockStatus] ?? 2) - (rank[b.stockStatus] ?? 2)
    if (d) return d
    return a.name.localeCompare(b.name, 'id')
  })
})
const { page, pageSize, paged, total, totalPages, rangeStart, rangeEnd, reset } = usePagination(
  filteredMaterials,
  10
)
watch([search, onlyRestock], reset)

const statusCounts = computed(() => {
  const rows = materials.value || []
  return {
    ok: rows.filter((m) => m.stockStatus === 'ok').length,
    low: rows.filter((m) => m.stockStatus === 'low').length,
    empty: rows.filter((m) => m.stockStatus === 'empty').length
  }
})

const showForm = ref(false)
const editing = ref(null)
const form = ref({})
const errorMsg = ref('')

const buyTarget = ref(null)
const buyForm = ref({})
const buyError = ref('')
const buySaving = ref(false)
const buyTotal = computed(() =>
  Math.round((Number(buyForm.value.quantity) || 0) * (Number(buyForm.value.unitPrice) || 0)) +
  Math.max(Math.round(Number(buyForm.value.shippingFee) || 0), 0)
)
const buyStockIn = computed(() => stockQtyFromPurchase(buyTarget.value, buyForm.value.quantity))
const buyUnit = computed(() => purchaseUnitOf(buyTarget.value))

const useTarget = ref(null)
const useQty = ref(1)
const useProjectId = ref('')
const useDate = ref('')
const useError = ref('')
const useSaving = ref(false)

const formConversion = computed(() =>
  formatPurchaseConversion({
    unit: form.value.unit,
    purchaseUnit: form.value.purchaseUnit,
    unitsPerPurchase: form.value.unitsPerPurchase
  })
)
const formBuyPrice = computed(() =>
  purchasePriceOf({
    pricePerUnit: form.value.pricePerUnit,
    unitsPerPurchase: form.value.unitsPerPurchase,
    purchaseUnit: form.value.purchaseUnit
  })
)

function openAdd() {
  editing.value = null
  form.value = {
    name: '',
    type: 'consumable',
    unit: 'pcs',
    purchaseUnit: '',
    unitsPerPurchase: 1,
    stockQuantity: 0,
    lowStockQuantity: 2,
    pricePerUnit: 0,
    supplier: ''
  }
  errorMsg.value = ''
  showForm.value = true
}
function openEdit(m) {
  editing.value = m
  form.value = {
    ...m,
    purchaseUnit: m.purchaseUnit || '',
    unitsPerPurchase: Number(m.unitsPerPurchase) > 1 ? Number(m.unitsPerPurchase) : 1,
    pricePerUnit: Number(m.pricePerUnit) || 0
  }
  errorMsg.value = ''
  showForm.value = true
}
async function save() {
  errorMsg.value = ''
  try {
    const body = {
      ...form.value,
      unit: form.value.unit || 'pcs',
      purchaseUnit: form.value.purchaseUnit || '',
      unitsPerPurchase: Number(form.value.unitsPerPurchase) || 1,
      pricePerUnit: Number(form.value.pricePerUnit) || 0,
      stockQuantity: Number(form.value.stockQuantity) || 0,
      lowStockQuantity: Number(form.value.lowStockQuantity) || 2
    }
    if (editing.value) {
      await $fetch(`/api/materials/${editing.value.id}`, { method: 'PUT', body })
      useToast().success('Perlengkapan diperbarui.')
    } else {
      await $fetch('/api/materials', { method: 'POST', body })
      useToast().success('Perlengkapan tersimpan.')
    }
    showForm.value = false
    editing.value = null
    await refresh()
  } catch (e) {
    errorMsg.value = e.data?.statusMessage || 'Gagal menyimpan'
  }
}
async function remove(m) {
  if (!(await useConfirm().confirm(`Hapus "${m.name}" dari daftar?`))) return
  try {
    await $fetch(`/api/materials/${m.id}`, { method: 'DELETE' })
    await refresh()
  } catch (e) {
    useToast().error(e.data?.statusMessage || 'Gagal menghapus')
  }
}

function openBuy(m) {
  buyTarget.value = m
  buyForm.value = {
    date: todayStr(),
    supplier: m.supplier || suppliers.value?.[0]?.name || '',
    quantity: 1,
    unitPrice: purchasePriceOf(m),
    shippingFee: 0,
    notes: ''
  }
  buyError.value = ''
}
async function saveBuy() {
  buyError.value = ''
  if (!buyForm.value.supplier) {
    buyError.value = 'Supplier / toko wajib diisi'
    return
  }
  if (!(Number(buyForm.value.quantity) > 0)) {
    buyError.value = 'Qty wajib lebih dari 0'
    return
  }
  buySaving.value = true
  try {
    await $fetch('/api/purchases', {
      method: 'POST',
      body: {
        date: buyForm.value.date,
        supplier: buyForm.value.supplier,
        category: 'material',
        notes: buyForm.value.notes || null,
        shippingFee: buyForm.value.shippingFee || 0,
        platformFee: 0,
        lines: [
          {
            itemType: 'material',
            materialId: buyTarget.value.id,
            quantity: buyForm.value.quantity,
            unitPrice: buyForm.value.unitPrice
          }
        ]
      }
    })
    useToast().success('Pembelian tercatat. Kas terpotong, stok bertambah.')
    buyTarget.value = null
    await refresh()
  } catch (e) {
    buyError.value = e.data?.statusMessage || 'Gagal mencatat pembelian'
  } finally {
    buySaving.value = false
  }
}

function openUse(m) {
  useTarget.value = m
  useQty.value = 1
  useProjectId.value = ''
  useDate.value = todayStr()
  useError.value = ''
}
async function saveUse() {
  const qty = Math.round(Number(useQty.value) || 0)
  useError.value = ''
  if (!useProjectId.value) {
    useError.value = 'Pilih proyek'
    return
  }
  if (qty <= 0) {
    useError.value = 'Qty pemakaian wajib diisi'
    return
  }
  useSaving.value = true
  try {
    await $fetch(`/api/materials/${useTarget.value.id}/usages`, {
      method: 'POST',
      body: { productId: Number(useProjectId.value), quantity: qty, date: useDate.value }
    })
    useToast().success('Pemakaian tercatat. Stok berkurang dan masuk revenue proyek.')
    useTarget.value = null
    await refresh()
  } catch (e) {
    useError.value = e.data?.statusMessage || 'Gagal mencatat pemakaian'
  } finally {
    useSaving.value = false
  }
}
</script>

<template>
  <div class="space-y-4">
    <div class="flex items-center justify-between gap-2">
      <div>
        <h1 class="text-xl font-bold">Perlengkapan</h1>
        <p class="text-xs text-ink-500">
          Beli pakai qty — kas terpotong otomatis. Pakai mencatat pemakaian ke proyek dan mengurangi stok, tanpa memotong kas lagi.
        </p>
      </div>
      <div v-if="isAdmin" class="flex items-center gap-2">
        <StockRepairButton kind="materials" @done="refresh" />
        <button class="btn-primary" @click="openAdd">
          <PlusIcon class="w-4 h-4" /><span class="hidden sm:inline">Tambah</span>
        </button>
      </div>
    </div>

    <div class="grid grid-cols-3 gap-2 sm:gap-3">
      <div class="panel p-3 sm:p-4">
        <div class="text-xs font-semibold uppercase tracking-wide text-ink-500">Ada</div>
        <div class="mt-1 font-mono text-lg sm:text-xl font-semibold text-teal-700">{{ statusCounts.ok }}</div>
      </div>
      <div class="panel p-3 sm:p-4">
        <div class="text-xs font-semibold uppercase tracking-wide text-ink-500">Menipis</div>
        <div class="mt-1 font-mono text-lg sm:text-xl font-semibold text-amber-700">{{ statusCounts.low }}</div>
      </div>
      <div class="panel p-3 sm:p-4">
        <div class="text-xs font-semibold uppercase tracking-wide text-ink-500">Habis</div>
        <div class="mt-1 font-mono text-lg sm:text-xl font-semibold text-red-600">{{ statusCounts.empty }}</div>
      </div>
    </div>

    <div class="flex flex-col sm:flex-row sm:items-center gap-2">
      <div class="relative w-full md:max-w-xs">
        <MagnifyingGlassIcon class="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-ink-400 pointer-events-none" />
        <input
          v-model="search"
          class="input pl-9 w-full"
          type="search"
          enterkeyhint="search"
          autocomplete="off"
          placeholder="Cari nama…"
        />
      </div>
      <label class="flex items-center gap-2 text-sm text-ink-600 cursor-pointer select-none">
        <input v-model="onlyRestock" type="checkbox" />
        Hanya menipis / habis
      </label>
    </div>

    <div class="md:hidden space-y-2">
      <div v-for="m in paged" :key="m.id" class="panel p-3 space-y-3">
        <div class="flex items-start justify-between gap-2">
          <div class="min-w-0">
            <CopyableText :text="m.name" class="font-medium break-words leading-snug">{{ m.name }}</CopyableText>
            <span class="badge mt-1" :class="materialTypeBadge(m.type)">{{ materialTypeLabel(m.type) }}</span>
          </div>
          <span class="badge shrink-0" :class="stockStatusBadge(m.stockStatus)">{{ stockStatusLabel(m.stockStatus) }}</span>
        </div>
        <dl class="grid grid-cols-2 gap-2 text-sm">
          <div class="rounded-panel bg-ink-50 px-2.5 py-2">
            <dt class="text-[10px] uppercase tracking-wide text-ink-500">Stok</dt>
            <dd class="font-mono font-medium mt-0.5">{{ formatNumber(m.stockQuantity) }} {{ m.unit }}</dd>
          </div>
          <div class="rounded-panel bg-ink-50 px-2.5 py-2">
            <dt class="text-[10px] uppercase tracking-wide text-ink-500">Harga terakhir</dt>
            <dd class="font-mono font-medium mt-0.5">{{ formatIDR(m.pricePerUnit) }}/{{ m.unit }}</dd>
            <dd v-if="formatPurchaseConversion(m)" class="text-[11px] text-sky-800 mt-0.5">{{ formatPurchaseConversion(m) }}</dd>
          </div>
        </dl>
        <div class="btn-actions border-t border-ink-100 pt-2">
          <button class="btn-action-primary" @click="openBuy(m)">
            <ShoppingCartIcon class="w-3.5 h-3.5" />Beli
          </button>
          <button class="btn-action" @click="openUse(m)">
            <ArrowsUpDownIcon class="w-3.5 h-3.5" />Pakai
          </button>
          <template v-if="isAdmin">
            <button class="btn-action" @click="openEdit(m)">
              <PencilSquareIcon class="w-3.5 h-3.5" />Edit
            </button>
            <button class="btn-action-danger" @click="remove(m)">
              <TrashIcon class="w-3.5 h-3.5" />Hapus
            </button>
          </template>
        </div>
      </div>
      <p v-if="!total" class="panel p-6 text-center text-sm text-ink-500">
        {{ search || onlyRestock ? 'Tidak ada yang cocok.' : 'Belum ada perlengkapan. Tambah dulu, lalu catat pembelian.' }}
      </p>
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
              <th>Nama</th>
              <th>Jenis</th>
              <th class="text-right">Stok</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="m in paged" :key="m.id">
              <td class="font-medium">
                <CopyableText :text="m.name">{{ m.name }}</CopyableText>
                <div class="text-xs text-ink-400 font-normal mt-0.5">{{ formatIDR(m.pricePerUnit) }}/{{ m.unit }}</div>
                <div v-if="formatPurchaseConversion(m)" class="text-[11px] text-sky-800 font-normal">{{ formatPurchaseConversion(m) }}</div>
              </td>
              <td>
                <span class="badge" :class="materialTypeBadge(m.type)">{{ materialTypeLabel(m.type) }}</span>
              </td>
              <td class="num">{{ formatNumber(m.stockQuantity) }} {{ m.unit }}</td>
              <td>
                <span class="badge" :class="stockStatusBadge(m.stockStatus)">{{ stockStatusLabel(m.stockStatus) }}</span>
              </td>
              <td class="whitespace-nowrap text-right">
                <div class="btn-actions justify-end">
                  <button class="btn-action-primary" @click="openBuy(m)"><ShoppingCartIcon class="w-3.5 h-3.5" />Beli</button>
                  <button class="btn-action" @click="openUse(m)"><ArrowsUpDownIcon class="w-3.5 h-3.5" />Pakai</button>
                  <template v-if="isAdmin">
                    <button class="btn-action" @click="openEdit(m)"><PencilSquareIcon class="w-3.5 h-3.5" />Edit</button>
                    <button class="btn-action-danger" @click="remove(m)"><TrashIcon class="w-3.5 h-3.5" />Hapus</button>
                  </template>
                </div>
              </td>
            </tr>
            <tr v-if="!total">
              <td colspan="5" class="text-center text-ink-500 py-6">
                {{ search || onlyRestock ? 'Tidak ada yang cocok.' : 'Belum ada perlengkapan. Tambah dulu, lalu catat pembelian.' }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <AppPagination
        v-model:page="page"
        v-model:pageSize="pageSize"
        :total-pages="totalPages"
        :range-start="rangeStart"
        :range-end="rangeEnd"
        :total="total"
      />
    </div>

    <AppModal v-if="showForm" :title="editing ? 'Edit Perlengkapan' : 'Tambah Perlengkapan'" @close="showForm = false">
      <form class="space-y-3" @submit.prevent="save">
        <div>
          <label class="label">Nama</label>
          <input v-model="form.name" class="input" required placeholder="Cable ties 20 cm, klem 20 mm…" />
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="label">Jenis</label>
            <select v-model="form.type" class="input">
              <option v-for="t in materialTypeOptions(form.type)" :key="t.id" :value="t.id">{{ t.label }}</option>
            </select>
          </div>
          <div>
            <label class="label">Satuan pakai di proyek</label>
            <select v-model="form.unit" class="input">
              <option v-for="u in MATERIAL_UNITS" :key="u" :value="u">{{ u }}</option>
            </select>
            <p class="text-xs text-ink-400 mt-1">Qty di checklist proyek memakai satuan ini.</p>
          </div>
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="label">Harga modal / satuan pakai</label>
            <IdrInput v-model="form.pricePerUnit" required />
            <p class="text-xs text-ink-400 mt-1">
              Disimpan per {{ form.unit || 'pcs' }}.
              <span v-if="formConversion">Harga pack dihitung otomatis saat beli.</span>
            </p>
          </div>
          <div>
            <label class="label">Stok awal</label>
            <input v-model.number="form.stockQuantity" type="number" min="0" step="1" class="input-num" />
            <p class="text-xs text-ink-400 mt-1">Dalam satuan pakai. Tidak potong kas.</p>
          </div>
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="label">Satuan beli</label>
            <select v-model="form.purchaseUnit" class="input">
              <option value="">Sama dengan satuan pakai</option>
              <option v-for="u in MATERIAL_BUY_UNITS" :key="u" :value="u">{{ u }}</option>
              <option
                v-if="form.purchaseUnit && !MATERIAL_BUY_UNITS.includes(form.purchaseUnit)"
                :value="form.purchaseUnit"
              >
                {{ form.purchaseUnit }}
              </option>
            </select>
          </div>
          <div>
            <label class="label">Isi per satuan beli</label>
            <input v-model.number="form.unitsPerPurchase" type="number" min="1" step="1" class="input-num" />
            <p class="text-[11px] text-ink-400 mt-0.5">1 pack = 50 pcs → satuan pakai pcs, satuan beli pack, isi 50.</p>
          </div>
        </div>
        <div v-if="formConversion" class="rounded-panel border border-ink-200 bg-ink-50 px-3 py-2 text-xs text-ink-600">
          {{ formConversion }}
          <span v-if="form.pricePerUnit"> · beli {{ formatIDR(formBuyPrice) }}/{{ purchaseUnitOf(form) }}</span>
        </div>
        <div>
          <label class="label">Menipis jika sisa ≤</label>
          <input v-model.number="form.lowStockQuantity" type="number" min="0" step="1" class="input-num" />
        </div>
        <p v-if="errorMsg" class="text-sm text-red-600">{{ errorMsg }}</p>
        <div class="flex justify-end gap-2 pt-2">
          <button type="button" class="btn-secondary" @click="showForm = false">
            <XMarkIcon class="w-4 h-4" />Batal
          </button>
          <button type="submit" class="btn-primary"><CheckIcon class="w-4 h-4" />Simpan</button>
        </div>
      </form>
    </AppModal>

    <AppModal v-if="buyTarget" :title="`Beli ${buyTarget.name}`" @close="buyTarget = null">
      <form class="space-y-3" @submit.prevent="saveBuy">
        <p class="text-xs text-ink-500">
          Stok sekarang {{ formatNumber(buyTarget.stockQuantity) }} {{ buyTarget.unit }}. Total beli masuk pengeluaran dan memotong estimasi kas.
        </p>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div class="date-field">
            <label class="label">Tanggal</label>
            <input v-model="buyForm.date" type="date" class="input" required />
          </div>
          <div>
            <label class="label">Toko / supplier</label>
            <input
              v-model="buyForm.supplier"
              class="input"
              list="perlengkapan-supplier-list"
              required
              placeholder="Toko bangunan, Shopee…"
            />
            <datalist id="perlengkapan-supplier-list">
              <option v-for="s in suppliers" :key="s.id" :value="s.name" />
            </datalist>
          </div>
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="label">Qty ({{ buyUnit }})</label>
            <input v-model.number="buyForm.quantity" type="number" min="1" step="1" class="input-num" required />
            <p v-if="purchaseStockMultiplier(buyTarget) > 1" class="text-[11px] text-ink-400 mt-0.5">
              Masuk stok {{ formatNumber(buyStockIn) }} {{ buyTarget.unit }}
              ({{ formatPurchaseConversion(buyTarget) }})
            </p>
          </div>
          <div>
            <label class="label">Harga / {{ buyUnit }}</label>
            <IdrInput v-model="buyForm.unitPrice" required />
          </div>
        </div>
        <div>
          <label class="label">Ongkir (opsional)</label>
          <IdrInput v-model="buyForm.shippingFee" />
        </div>
        <div>
          <label class="label">Catatan</label>
          <input v-model="buyForm.notes" class="input" placeholder="opsional" />
        </div>
        <div class="flex items-center justify-between pt-1 border-t border-ink-200">
          <span class="text-sm text-ink-600 font-medium">Total kas keluar</span>
          <span class="font-mono text-lg font-bold">{{ formatIDR(buyTotal) }}</span>
        </div>
        <p v-if="buyError" class="text-sm text-red-600">{{ buyError }}</p>
        <div class="flex justify-end gap-2 pt-2">
          <button type="button" class="btn-secondary" @click="buyTarget = null">
            <XMarkIcon class="w-4 h-4" />Batal
          </button>
          <button type="submit" class="btn-primary" :disabled="buySaving">
            <CheckIcon class="w-4 h-4" />{{ buySaving ? 'Menyimpan…' : 'Simpan pembelian' }}
          </button>
        </div>
      </form>
    </AppModal>

    <AppModal v-if="useTarget" :title="`Pakai ${useTarget.name}`" @close="useTarget = null">
      <form class="space-y-3" @submit.prevent="saveUse">
        <p class="text-sm text-ink-600">
          Stok sekarang
          <span class="font-mono font-semibold">{{ formatNumber(useTarget.stockQuantity) }} {{ useTarget.unit }}</span>.
          Nilai pemakaian dipotong dari jasa proyek. Kas tidak terpotong lagi.
        </p>
        <div>
          <label class="label">Proyek</label>
          <select v-model="useProjectId" class="input" required>
            <option value="">Pilih proyek</option>
            <option v-for="p in projects" :key="p.id" :value="String(p.id)">{{ p.name }}</option>
          </select>
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label class="label">Qty dipakai</label>
            <input v-model.number="useQty" type="number" min="1" step="1" class="input-num" required />
          </div>
          <div class="date-field">
            <label class="label">Tanggal</label>
            <input v-model="useDate" type="date" class="input" required />
          </div>
        </div>
        <p class="text-xs text-ink-500">
          Nilai {{ formatIDR((Number(useQty) || 0) * (Number(useTarget.pricePerUnit) || 0)) }}
          ({{ formatIDR(useTarget.pricePerUnit) }}/{{ useTarget.unit }}).
        </p>
        <p v-if="useError" class="text-sm text-red-600">{{ useError }}</p>
        <div class="flex justify-end gap-2 pt-2">
          <button type="button" class="btn-secondary" @click="useTarget = null">
            <XMarkIcon class="w-4 h-4" />Batal
          </button>
          <button type="submit" class="btn-primary" :disabled="useSaving">
            <CheckIcon class="w-4 h-4" />{{ useSaving ? 'Menyimpan…' : 'Catat pemakaian' }}
          </button>
        </div>
      </form>
    </AppModal>
  </div>
</template>
