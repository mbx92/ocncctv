<script setup>
import {
  PlusIcon,
  TrashIcon,
  CheckIcon,
  XMarkIcon,
  CalendarDaysIcon,
  ArrowPathIcon,
  ExclamationTriangleIcon,
  PrinterIcon,
  BanknotesIcon,
  PhotoIcon
} from '@heroicons/vue/24/outline'
import { normalizeProductStatus, productStatusLabel, productStatusClass } from '~/utils/productStatus.js'

const paymentLabel = { unpaid: 'Belum bayar', paid: 'Lunas' }
const paymentMethodLabel = {
  cash: 'Tunai',
  transfer: 'Transfer',
  marketplace: 'Lainnya',
  other: 'Lainnya'
}

const filters = ref({ productId: '', paymentStatus: '', dateFrom: '', dateTo: '' })
function setThisMonth() {
  filters.value.dateFrom = monthStartStr()
  filters.value.dateTo = todayStr()
}
function clearFilters() {
  filters.value = { productId: '', paymentStatus: '', dateFrom: '', dateTo: '' }
}

const query = computed(() => {
  const q = {}
  for (const [k, v] of Object.entries(filters.value)) if (v) q[k] = v
  return q
})
const { data: sales, refresh } = await useFetch('/api/sales', { query })
const { data: products, refresh: refreshProducts } = await useFetch('/api/products')

const { page, pageSize, paged, total, totalPages, rangeStart, rangeEnd, reset } = usePagination(
  computed(() => sales.value || []),
  10
)
watch(query, reset, { deep: true })

const totals = computed(() => {
  const rows = sales.value || []
  return {
    count: rows.length,
    gross: rows.reduce((a, r) => a + r.grossRevenue, 0),
    net: rows.reduce((a, r) => a + r.netRevenue, 0),
    unpaid: rows.filter((r) => r.paymentStatus === 'unpaid').reduce((a, r) => a + r.netRevenue, 0)
  }
})

// ——— Form catat penjualan ———
const showForm = ref(false)
const form = ref({})
const errorMsg = ref('')
const saving = ref(false)

const sellableProducts = computed(() => (products.value || []).filter((p) => !p.hasSale))

function preferredProduct() {
  const list = sellableProducts.value
  return (
    list.find((p) => normalizeProductStatus(p.status) === 'in_progress') ||
    list.find((p) => normalizeProductStatus(p.status) === 'waiting') ||
    list[0] ||
    null
  )
}

function applyProject(p) {
  form.value.quantity = 1
  form.value.salePricePerUnit = p?.revenue || 0
  form.value.customerName = p?.customerName || ''
}

function openAdd() {
  const p = preferredProduct()
  form.value = {
    date: todayStr(),
    productId: p?.id || '',
    quantity: 1,
    salePricePerUnit: p?.revenue || 0,
    customerName: p?.customerName || '',
    notes: '',
    discountAmount: 0,
    discountKind: 'amount',
    discountPercent: 0,
    paymentNotes: '',
    paymentStatus: 'paid',
    paymentMethod: 'cash',
    paidAt: todayStr(),
  }
  errorMsg.value = ''
  showForm.value = true
}

const selectedProduct = computed(() =>
  (products.value || []).find((p) => p.id === Number(form.value.productId))
)

const preview = computed(() => {
  const price = Math.max(Number(form.value.salePricePerUnit) || 0, 0)
  const goodsCost = selectedProduct.value?.hasRab ? selectedProduct.value.goodsCost || 0 : 0
  const gross = price
  const discount =
    form.value.discountKind === 'percent'
      ? Math.round(gross * (Math.min(Math.max(Number(form.value.discountPercent) || 0, 0), 100) / 100))
      : Math.min(Math.max(Math.round(Number(form.value.discountAmount) || 0), 0), gross)
  const net = gross - discount
  const margin = net - goodsCost
  return {
    goodsCost,
    hasCost: !!selectedProduct.value?.hasRab,
    rabRevenue: selectedProduct.value?.revenue || 0,
    goodsSale: selectedProduct.value?.goodsSale || 0,
    serviceSale: selectedProduct.value?.serviceSale || 0,
    gross,
    discount,
    net,
    margin,
    marginPercent: net ? Math.round((margin / net) * 100) : 0
  }
})
const belowCost = computed(() => preview.value.hasCost && preview.value.net < preview.value.goodsCost)

watch(
  () => form.value.productId,
  (id) => {
    if (!showForm.value) return
    applyProject((products.value || []).find((p) => p.id === Number(id)))
  }
)

watch(
  () => form.value.paymentStatus,
  (status) => {
    if (!showForm.value) return
    if (status === 'paid') {
      if (!form.value.paidAt) form.value.paidAt = form.value.date || todayStr()
      if (!form.value.paymentMethod) form.value.paymentMethod = 'cash'
    }
  }
)

async function save() {
  errorMsg.value = ''
  saving.value = true
  try {
    await $fetch('/api/sales', { method: 'POST', body: { ...form.value, channel: 'direct', marketplaceFeePercent: 0 } })
    showForm.value = false
    await refresh()
    await refreshProducts()
    useToast().success('Penjualan tercatat.')
  } catch (e) {
    errorMsg.value = e.data?.statusMessage || 'Gagal menyimpan'
  } finally {
    saving.value = false
  }
}
function saleGross(s) {
  return (s.salePricePerUnit || 0) * (s.quantity || 0)
}
function discountLine(s) {
  if (!s.discountAmount) return ''
  if (s.discountKind === 'percent') return `diskon ${s.discountPercent}% (${formatIDR(s.discountAmount)})`
  return `diskon ${formatIDR(s.discountAmount)}`
}

async function markPaid(s) {
  payTarget.value = s
  payForm.value = {
    paymentMethod: s.paymentMethod === 'marketplace' ? 'other' : s.paymentMethod || 'cash',
    paidAt: todayStr(),
    discountKind: s.discountKind === 'percent' ? 'percent' : 'amount',
    discountAmount: s.discountAmount || 0,
    discountPercent: s.discountPercent || 0,
    paymentNotes: s.paymentNotes || ''
  }
  payError.value = ''
}
const payTarget = ref(null)
const payForm = ref({})
const payError = ref('')
const paySaving = ref(false)
const payPreview = computed(() => {
  const s = payTarget.value
  if (!s) return null
  const gross = saleGross(s)
  const discount =
    payForm.value.discountKind === 'percent'
      ? Math.round(gross * (Math.min(Math.max(Number(payForm.value.discountPercent) || 0, 0), 100) / 100))
      : Math.min(Math.max(Math.round(Number(payForm.value.discountAmount) || 0), 0), gross)
  return { gross, discount, net: gross - discount }
})
function setDiscountKind(target, kind) {
  const cap = target === 'pay' ? payPreview.value?.gross || 0 : preview.value?.gross || 0
  const formRef = target === 'pay' ? payForm : form
  if (formRef.value.discountKind === kind) return
  if (kind === 'percent') {
    formRef.value.discountPercent = cap
      ? Math.min(100, Math.round(((Number(formRef.value.discountAmount) || 0) / cap) * 1000) / 10)
      : 0
  } else {
    const p = Math.min(Math.max(Number(formRef.value.discountPercent) || 0, 0), 100)
    formRef.value.discountAmount = Math.round(cap * (p / 100))
  }
  formRef.value.discountKind = kind
}
function closePay() {
  payTarget.value = null
  payError.value = ''
}
async function submitPay() {
  const s = payTarget.value
  if (!s) return
  paySaving.value = true
  payError.value = ''
  try {
    await $fetch(`/api/sales/${s.id}/payment`, {
      method: 'PUT',
      body: {
        paymentStatus: 'paid',
        paymentMethod: payForm.value.paymentMethod,
        paidAt: payForm.value.paidAt,
        discountKind: payForm.value.discountKind,
        discountAmount: payForm.value.discountAmount,
        discountPercent: payForm.value.discountPercent,
        paymentNotes: payForm.value.paymentNotes
      }
    })
    closePay()
    await refresh()
    useToast().success('Pembayaran dicatat.')
  } catch (e) {
    payError.value = e.data?.statusMessage || 'Gagal mencatat pembayaran'
  } finally {
    paySaving.value = false
  }
}
async function markUnpaid(s) {
  try {
    await $fetch(`/api/sales/${s.id}/payment`, { method: 'PUT', body: { paymentStatus: 'unpaid' } })
    await refresh()
    useToast().success('Ditandai belum bayar.')
  } catch (e) {
    useToast().error(e.data?.statusMessage || 'Gagal memperbarui pembayaran')
  }
}
async function remove(s) {
  if (!(await useConfirm().confirm('Hapus catatan penjualan ini?'))) return
  await $fetch(`/api/sales/${s.id}`, { method: 'DELETE' })
  await refresh()
  await refreshProducts()
}
</script>

<template>
  <div class="space-y-4">
    <div class="flex items-center justify-between gap-2">
      <h1 class="text-xl font-bold">Penjualan</h1>
      <button class="btn-primary" @click="openAdd">
        <PlusIcon class="w-4 h-4" /><span class="hidden sm:inline">Catat Penjualan</span><span class="sm:hidden">Catat</span>
      </button>
    </div>

    <!-- Filter -->
    <div class="panel p-3 space-y-2 overflow-hidden">
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:flex lg:flex-wrap lg:items-end gap-2 min-w-0">
        <div class="min-w-0 lg:w-44">
          <label class="label">Proyek</label>
          <select v-model="filters.productId" class="input">
            <option value="">Semua</option>
            <option v-for="p in products" :key="p.id" :value="p.id">{{ p.name }}</option>
          </select>
        </div>
        <div class="min-w-0 lg:w-36">
          <label class="label">Pembayaran</label>
          <select v-model="filters.paymentStatus" class="input">
            <option value="">Semua</option>
            <option value="unpaid">Belum bayar</option>
            <option value="paid">Lunas</option>
          </select>
        </div>
        <div class="date-range col-span-full lg:contents">
          <div class="date-field lg:w-40">
            <label class="label">Dari</label>
            <input v-model="filters.dateFrom" type="date" class="input" />
          </div>
          <div class="date-field lg:w-40">
            <label class="label">Sampai</label>
            <input v-model="filters.dateTo" type="date" class="input" />
          </div>
        </div>
        <div class="flex gap-2 col-span-full lg:col-auto">
          <button type="button" class="btn-secondary flex-1 lg:flex-none" @click="setThisMonth">
            <CalendarDaysIcon class="w-3.5 h-3.5" />Bulan ini
          </button>
          <button type="button" class="btn-secondary flex-1 lg:flex-none" @click="clearFilters">
            <ArrowPathIcon class="w-3.5 h-3.5" />Reset
          </button>
        </div>
      </div>
    </div>

    <!-- Running totals -->
    <div class="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
      <div class="panel p-3">
        <div class="text-xs text-ink-500 uppercase font-semibold">Transaksi</div>
        <div class="font-mono text-lg sm:text-xl font-semibold">{{ formatNumber(totals.count) }}</div>
      </div>
      <div class="panel p-3">
        <div class="text-xs text-ink-500 uppercase font-semibold">Revenue kotor</div>
        <div class="font-mono text-lg sm:text-xl font-semibold">{{ formatIDR(totals.gross) }}</div>
      </div>
      <div class="panel p-3">
        <div class="text-xs text-ink-500 uppercase font-semibold">Revenue bersih</div>
        <div class="font-mono text-lg sm:text-xl font-semibold text-teal-600">{{ formatIDR(totals.net) }}</div>
      </div>
      <div class="panel p-3">
        <div class="text-xs text-ink-500 uppercase font-semibold">Belum dibayar</div>
        <div class="font-mono text-lg sm:text-xl font-semibold text-amber-600">{{ formatIDR(totals.unpaid) }}</div>
      </div>
    </div>

    <!-- Kartu (mobile) -->
    <div class="md:hidden space-y-2">
      <div v-for="s in paged" :key="s.id" class="panel p-3 space-y-1">
        <div class="flex items-start justify-between gap-2">
          <div class="min-w-0">
            <div class="font-medium break-words">
              {{ s.productName }}
              <span v-if="s.isCustom" class="badge bg-ink-100 text-ink-500 ml-1">RAB</span>
            </div>
            <div class="text-xs font-mono text-ink-500">{{ formatDate(s.date) }}<span v-if="s.invoiceNumber"> · {{ s.invoiceNumber }}</span></div>
            <div v-if="s.customerName" class="text-xs text-ink-500">{{ s.customerName }}</div>
          </div>
        </div>
        <div class="flex flex-wrap gap-1">
          <span
            class="badge"
            :class="s.paymentStatus === 'paid' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-800'"
          >
            {{ paymentLabel[s.paymentStatus] || 'Belum bayar' }}
          </span>
          <span v-if="s.paymentStatus === 'paid' && s.paymentMethod" class="badge bg-ink-100 text-ink-600">
            {{ paymentMethodLabel[s.paymentMethod] || s.paymentMethod }}
          </span>
        </div>
        <div v-if="s.notes" class="text-xs text-ink-400">{{ s.notes }}</div>
        <div v-if="s.paymentStatus === 'paid' && s.discountAmount" class="text-xs text-ink-400">{{ discountLine(s) }}</div>
        <div v-if="s.paymentNotes" class="text-xs text-ink-400 break-words">{{ s.paymentNotes }}</div>
        <dl class="grid grid-cols-2 gap-x-3 gap-y-1 text-sm pt-1">
          <div class="flex justify-between"><dt class="text-ink-500">Nilai</dt><dd class="font-mono">{{ formatIDR(s.salePricePerUnit) }}</dd></div>
          <div class="flex justify-between">
            <dt class="text-ink-500">Bersih</dt>
            <dd class="font-mono">{{ formatIDR(s.netRevenue) }}</dd>
          </div>
        </dl>
        <div class="pt-1 btn-actions">
          <NuxtLink :to="`/sales/${s.id}/invoice`" class="btn-action">
            <PrinterIcon class="w-3.5 h-3.5" />Invoice
          </NuxtLink>
          <button v-if="s.paymentStatus !== 'paid'" class="btn-action" @click="markPaid(s)">
            <BanknotesIcon class="w-3.5 h-3.5" />Lunas
          </button>
          <button v-else class="btn-action" @click="markUnpaid(s)">Belum bayar</button>
          <button class="btn-action-danger" @click="remove(s)"><TrashIcon class="w-3.5 h-3.5" />Hapus</button>
        </div>
      </div>
      <p v-if="!total" class="panel p-6 text-center text-sm text-ink-500">Belum ada penjualan pada filter ini.</p>
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
              <th>Proyek</th>
              <th class="text-right">Nilai</th>
              <th class="text-right">Bersih</th>
              <th>Bayar</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="s in paged" :key="s.id">
              <td class="whitespace-nowrap font-mono text-xs">{{ formatDate(s.date) }}</td>
              <td class="font-medium">
                {{ s.productName }}
                <span v-if="s.isCustom" class="badge bg-ink-100 text-ink-500 ml-1">RAB</span>
                <div v-if="s.customerName" class="text-xs text-ink-500">{{ s.customerName }}</div>
                <div v-if="s.notes" class="text-xs text-ink-400">{{ s.notes }}</div>
              </td>
              <td class="num">{{ formatIDR(s.salePricePerUnit) }}</td>
              <td class="num">{{ formatIDR(s.netRevenue) }}</td>
              <td>
                <span
                  class="badge"
                  :class="s.paymentStatus === 'paid' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-800'"
                >
                  {{ paymentLabel[s.paymentStatus] || 'Belum bayar' }}
                </span>
                <div v-if="s.paymentStatus === 'paid'" class="text-xs text-ink-400 mt-0.5">
                  {{ paymentMethodLabel[s.paymentMethod] || s.paymentMethod || '—' }}
                  <span v-if="s.paidAt"> · {{ formatDate(s.paidAt) }}</span>
                  <span v-if="s.discountAmount"> · {{ discountLine(s) }}</span>
                </div>
                <div v-if="s.paymentNotes" class="text-xs text-ink-400 mt-0.5 break-words">{{ s.paymentNotes }}</div>
              </td>
              <td class="text-right whitespace-nowrap">
                <div class="btn-actions justify-end">
                  <NuxtLink :to="`/sales/${s.id}/invoice`" class="btn-action">
                    <PrinterIcon class="w-3.5 h-3.5" />Invoice
                  </NuxtLink>
                  <button v-if="s.paymentStatus !== 'paid'" class="btn-action" @click="markPaid(s)">
                    <BanknotesIcon class="w-3.5 h-3.5" />Lunas
                  </button>
                  <button class="btn-action-danger" @click="remove(s)"><TrashIcon class="w-3.5 h-3.5" />Hapus</button>
                </div>
              </td>
            </tr>
            <tr v-if="!total">
              <td colspan="6" class="text-center text-ink-500 py-6">Belum ada penjualan pada filter ini.</td>
            </tr>
          </tbody>
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

    <!-- Form catat penjualan: input di kiri, ringkasan revenue di kanan -->
    <AppModal v-if="showForm" title="Catat Penjualan" size="lg" @close="showForm = false">
      <form class="grid grid-cols-1 lg:grid-cols-5 gap-4" @submit.prevent="save">
        <div class="lg:col-span-3 space-y-3">
          <div class="date-field">
            <label class="label">Tanggal</label>
            <input v-model="form.date" type="date" class="input" required />
          </div>

          <div>
            <label class="label">Proyek</label>
            <select v-model="form.productId" class="input" required :disabled="!sellableProducts.length">
              <option v-if="!sellableProducts.length" value="">Tidak ada proyek yang belum tercatat</option>
              <option v-for="p in sellableProducts" :key="p.id" :value="p.id">
                {{ p.name }}{{ p.customerName ? ` · ${p.customerName}` : '' }}{{ p.hasRab ? ` — ${formatIDR(p.revenue)}` : '' }}
              </option>
            </select>
            <div v-if="selectedProduct" class="mt-2 space-y-1">
              <div class="flex flex-wrap items-center gap-1.5">
                <span class="badge" :class="productStatusClass(selectedProduct.status)">
                  {{ productStatusLabel[selectedProduct.status] || selectedProduct.status }}
                </span>
                <span v-if="selectedProduct.hasRab" class="badge bg-ink-100 text-ink-600">RAB</span>
              </div>
              <p v-if="selectedProduct.hasRab" class="text-xs text-ink-500">
                Nilai RAB {{ formatIDR(selectedProduct.revenue) }}
                <span v-if="selectedProduct.goodsCost"> · modal {{ formatIDR(selectedProduct.goodsCost) }}</span>
              </p>
              <p v-else class="text-xs text-amber-600">
                Proyek ini belum tertaut RAB — isi nilai penjualan manual.
              </p>
            </div>
            <p v-else-if="!sellableProducts.length" class="text-xs text-ink-500 mt-2">
              Semua proyek sudah tercatat, atau belum ada proyek. Deal RAB dulu, lalu catat penjualannya di sini.
            </p>
          </div>

          <div>
            <div class="flex items-end justify-between gap-2 mb-1">
              <label class="label !mb-0">Nilai penjualan</label>
              <button
                v-if="selectedProduct?.hasRab"
                type="button"
                class="text-xs font-medium text-accent-600 hover:text-accent-700"
                @click="form.salePricePerUnit = selectedProduct.revenue || 0"
              >
                Pakai nilai RAB
              </button>
            </div>
            <IdrInput v-model="form.salePricePerUnit" required />
          </div>

          <div>
            <label class="label">Nama pelanggan</label>
            <input v-model="form.customerName" class="input" placeholder="untuk invoice — opsional" />
          </div>

          <div>
            <label class="label">Catatan</label>
            <input v-model="form.notes" class="input" placeholder="opsional" />
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label class="label">Status bayar</label>
              <select v-model="form.paymentStatus" class="input">
                <option value="unpaid">Belum dibayar</option>
                <option value="paid">Sudah dibayar</option>
              </select>
            </div>
            <div v-if="form.paymentStatus === 'paid'" class="sm:col-span-2">
              <label class="label">Diskon</label>
              <div class="flex gap-2">
                <div class="inline-flex rounded-panel border border-ink-200 overflow-hidden shrink-0 h-10">
                  <button
                    type="button"
                    class="px-2.5 text-sm"
                    :class="form.discountKind === 'amount' ? 'bg-ink-100 text-ink-800' : 'text-ink-500 hover:bg-ink-50'"
                    @click="setDiscountKind('form', 'amount')"
                  >
                    Rp
                  </button>
                  <button
                    type="button"
                    class="px-2.5 text-sm border-l border-ink-200"
                    :class="form.discountKind === 'percent' ? 'bg-ink-100 text-ink-800' : 'text-ink-500 hover:bg-ink-50'"
                    @click="setDiscountKind('form', 'percent')"
                  >
                    %
                  </button>
                </div>
                <IdrInput v-if="form.discountKind !== 'percent'" v-model="form.discountAmount" input-class="w-full" />
                <input
                  v-else
                  v-model.number="form.discountPercent"
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  class="input-num flex-1"
                />
              </div>
              <p class="text-xs text-ink-400 mt-1">Rp atau % dari subtotal.</p>
            </div>
            <div v-if="form.paymentStatus === 'paid'" class="sm:col-span-2">
              <label class="label">Catatan pembayaran</label>
              <textarea v-model="form.paymentNotes" class="input min-h-[4rem]" rows="2" placeholder="opsional — mis. transfer BCA / potong voucher"></textarea>
            </div>
            <div v-if="form.paymentStatus === 'paid'">
              <label class="label">Metode</label>
              <select v-model="form.paymentMethod" class="input">
                <option value="cash">Tunai</option>
                <option value="transfer">Transfer</option>
                <option value="other">Lainnya</option>
              </select>
            </div>
            <div v-if="form.paymentStatus === 'paid'" class="date-field">
              <label class="label">Tanggal bayar</label>
              <input v-model="form.paidAt" type="date" class="input" />
            </div>
          </div>
        </div>

        <!-- Ringkasan transaksi -->
        <div class="lg:col-span-2">
          <div class="rounded-panel border border-ink-200 bg-ink-50 p-3 space-y-2 text-sm lg:sticky lg:top-2">
            <div class="panel-title">Ringkasan</div>
            <dl class="space-y-1.5">
              <div v-if="preview.hasCost && preview.goodsSale" class="flex justify-between gap-2">
                <dt class="text-ink-500">Barang</dt>
                <dd class="font-mono">{{ formatIDR(preview.goodsSale) }}</dd>
              </div>
              <div v-if="preview.hasCost && preview.serviceSale" class="flex justify-between gap-2">
                <dt class="text-ink-500">Jasa</dt>
                <dd class="font-mono">{{ formatIDR(preview.serviceSale) }}</dd>
              </div>
              <div v-if="preview.hasCost" class="flex justify-between gap-2">
                <dt class="text-ink-500">Nilai RAB</dt>
                <dd class="font-mono">{{ formatIDR(preview.rabRevenue) }}</dd>
              </div>
              <div v-if="preview.hasCost && preview.goodsCost" class="flex justify-between gap-2">
                <dt class="text-ink-500">Modal barang</dt>
                <dd class="font-mono">{{ formatIDR(preview.goodsCost) }}</dd>
              </div>
              <div class="flex justify-between gap-2">
                <dt class="text-ink-500">Revenue kotor</dt>
                <dd class="font-mono">{{ formatIDR(preview.gross) }}</dd>
              </div>
              <div v-if="preview.discount" class="flex justify-between gap-2">
                <dt class="text-ink-500">
                  Diskon
                  <span v-if="form.discountKind === 'percent'" class="font-normal">({{ form.discountPercent }}%)</span>
                </dt>
                <dd class="font-mono text-red-600">− {{ formatIDR(preview.discount) }}</dd>
              </div>
              <div class="flex justify-between gap-2 pt-1.5 border-t border-ink-200">
                <dt class="text-ink-600 font-medium">Revenue bersih</dt>
                <dd class="font-mono font-semibold text-teal-600">{{ formatIDR(preview.net) }}</dd>
              </div>
            </dl>
            <div v-if="belowCost" class="flex gap-2 rounded bg-red-50 border border-red-200 p-2 text-xs text-red-700">
              <ExclamationTriangleIcon class="w-4 h-4 shrink-0" />
              <span>Nilai penjualan di bawah modal barang — transaksi ini rugi.</span>
            </div>
          </div>
        </div>

        <div class="lg:col-span-5 space-y-2">
          <p v-if="errorMsg" class="text-sm text-red-600">{{ errorMsg }}</p>
          <div class="flex justify-end gap-2">
            <button type="button" class="btn-secondary" @click="showForm = false"><XMarkIcon class="w-4 h-4" />Batal</button>
            <button type="submit" class="btn-primary" :disabled="saving || !form.productId">
              <CheckIcon class="w-4 h-4" />{{ saving ? 'Menyimpan…' : 'Simpan Penjualan' }}
            </button>
          </div>
        </div>
      </form>
    </AppModal>

    <AppModal v-if="payTarget" title="Catat pembayaran" @close="closePay">
      <form class="space-y-3" @submit.prevent="submitPay">
        <div class="rounded-panel border border-ink-200 bg-ink-50 p-3">
          <div class="panel-title mb-2">Item</div>
          <div class="flex gap-3">
            <div class="w-16 h-16 rounded-panel border border-ink-200 bg-white overflow-hidden flex items-center justify-center shrink-0">
              <img
                v-if="payTarget.productId && payTarget.imageKey"
                :src="`/api/products/${payTarget.productId}/image`"
                alt=""
                class="w-full h-full object-cover"
              />
              <PhotoIcon v-else class="w-6 h-6 text-ink-300" />
            </div>
            <div class="min-w-0 flex-1 space-y-0.5">
              <div class="font-medium break-words">
                {{ payTarget.productName }}
                <span v-if="payTarget.isCustom" class="badge bg-ink-100 text-ink-500 ml-1">RAB</span>
              </div>
              <div class="text-xs text-ink-500">
                {{ formatDate(payTarget.date) }}
                <span v-if="payTarget.invoiceNumber"> · {{ payTarget.invoiceNumber }}</span>
              </div>
              <div v-if="payTarget.customerName" class="text-xs text-ink-500">{{ payTarget.customerName }}</div>
              <div class="flex flex-wrap items-center gap-1.5 pt-1">
                <span class="text-xs font-mono text-ink-600">{{ formatIDR(payTarget.salePricePerUnit) }}</span>
              </div>
            </div>
            <div class="text-right shrink-0">
              <div class="text-xs text-ink-400">Subtotal</div>
              <div class="font-mono font-semibold">{{ formatIDR((payTarget.salePricePerUnit || 0) * (payTarget.quantity || 0)) }}</div>
            </div>
          </div>
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label class="label">Metode</label>
            <select v-model="payForm.paymentMethod" class="input" required>
              <option value="cash">Tunai</option>
              <option value="transfer">Transfer</option>
              <option value="other">Lainnya</option>
            </select>
          </div>
          <div class="date-field">
            <label class="label">Tanggal bayar</label>
            <input v-model="payForm.paidAt" type="date" class="input" required />
          </div>
          <div class="sm:col-span-2">
            <label class="label">Diskon</label>
            <div class="flex gap-2">
              <div class="inline-flex rounded-panel border border-ink-200 overflow-hidden shrink-0 h-10">
                <button
                  type="button"
                  class="px-2.5 text-sm"
                  :class="payForm.discountKind === 'amount' ? 'bg-ink-100 text-ink-800' : 'text-ink-500 hover:bg-ink-50'"
                  @click="setDiscountKind('pay', 'amount')"
                >
                  Rp
                </button>
                <button
                  type="button"
                  class="px-2.5 text-sm border-l border-ink-200"
                  :class="payForm.discountKind === 'percent' ? 'bg-ink-100 text-ink-800' : 'text-ink-500 hover:bg-ink-50'"
                  @click="setDiscountKind('pay', 'percent')"
                >
                  %
                </button>
              </div>
              <IdrInput v-if="payForm.discountKind !== 'percent'" v-model="payForm.discountAmount" input-class="w-full" />
              <input
                v-else
                v-model.number="payForm.discountPercent"
                type="number"
                min="0"
                max="100"
                step="0.1"
                class="input-num flex-1"
              />
            </div>
            <p class="text-xs text-ink-400 mt-1">Rp atau % dari subtotal.</p>
          </div>
          <div class="sm:col-span-2">
            <label class="label">Catatan pembayaran</label>
            <textarea v-model="payForm.paymentNotes" class="input min-h-[4rem]" rows="2" placeholder="opsional — mis. transfer BCA / potong voucher"></textarea>
          </div>
        </div>
        <dl v-if="payPreview" class="rounded-panel border border-ink-200 bg-ink-50 p-3 space-y-1.5 text-sm">
          <div class="panel-title">Detail pembayaran</div>
          <div class="flex justify-between gap-2">
            <dt class="text-ink-500">Subtotal</dt>
            <dd class="font-mono">{{ formatIDR(payPreview.gross) }}</dd>
          </div>
          <div class="flex justify-between gap-2">
            <dt class="text-ink-500">
              Diskon
              <span v-if="payForm.discountKind === 'percent'" class="font-normal">({{ payForm.discountPercent }}%)</span>
            </dt>
            <dd class="font-mono text-red-600">− {{ formatIDR(payPreview.discount) }}</dd>
          </div>
          <div class="flex justify-between gap-2 pt-1.5 border-t border-ink-200">
            <dt class="font-medium">Diterima</dt>
            <dd class="font-mono font-semibold text-teal-600">{{ formatIDR(payPreview.net) }}</dd>
          </div>
        </dl>
        <p v-if="payError" class="text-sm text-red-600">{{ payError }}</p>
        <div class="flex justify-end gap-2">
          <button type="button" class="btn-secondary" @click="closePay"><XMarkIcon class="w-4 h-4" />Batal</button>
          <button type="submit" class="btn-primary" :disabled="paySaving">
            <CheckIcon class="w-4 h-4" />{{ paySaving ? 'Menyimpan…' : 'Simpan lunas' }}
          </button>
        </div>
      </form>
    </AppModal>
  </div>
</template>
