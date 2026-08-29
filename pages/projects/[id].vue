<script setup>
import {
  CheckIcon,
  ArrowUpTrayIcon,
  EyeIcon,
  ArrowDownTrayIcon,
  TrashIcon,
  PlusIcon,
  ListBulletIcon,
  Squares2X2Icon,
  PencilSquareIcon,
  XMarkIcon,
  DocumentTextIcon,
  UserIcon,
  CalendarDaysIcon,
  CubeIcon,
  WrenchScrewdriverIcon,
  FolderIcon,
  BanknotesIcon,
  PlayIcon,
  CheckCircleIcon,
  TruckIcon
} from '@heroicons/vue/24/outline'
import { productStatusLabel, productStatusClass, normalizeProductStatus } from '~/utils/productStatus.js'
import {
  catalogLines,
  serviceLines,
  lineAmount,
  rabLineTypeBadge,
  rabLineTypeLabel,
  rabStatusLabel,
  rabStatusBadge,
  summarizeProjectRevenue
} from '~/utils/rab.js'

const route = useRoute()
const id = route.params.id
const isAdmin = computed(() => useState('authUser').value?.role === 'admin')

const { data: product, refresh } = await useFetch(`/api/products/${id}`)
const { data: settings } = await useFetch('/api/settings')
const { data: suppliers } = await useFetch('/api/suppliers')

const info = ref({
  name: product.value?.name,
  description: product.value?.description
})
const savingInfo = ref(false)
const plannedStartDate = ref(product.value?.plannedStartDate || '')
const actingStatus = ref('')
const projectPhase = computed(() => normalizeProductStatus(product.value?.status))

watch(
  () => product.value && `${product.value.name}|${product.value.description}|${product.value.plannedStartDate}|${product.value.status}`,
  () => {
    if (!product.value || savingInfo.value) return
    info.value = {
      name: product.value.name,
      description: product.value.description
    }
    if (!actingStatus.value) plannedStartDate.value = product.value.plannedStartDate || ''
  }
)

function initials(name) {
  const parts = String(name || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
  if (!parts.length) return 'P'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[1][0]).toUpperCase()
}

async function saveInfo() {
  savingInfo.value = true
  try {
    await $fetch(`/api/products/${id}`, {
      method: 'PUT',
      body: {
        name: info.value.name,
        description: info.value.description
      }
    })
    await refresh()
    useToast().success('Info proyek tersimpan.')
  } catch (e) {
    useToast().error(e.data?.statusMessage || 'Gagal menyimpan')
  } finally {
    savingInfo.value = false
  }
}

async function saveSchedule() {
  actingStatus.value = 'schedule'
  try {
    await $fetch(`/api/products/${id}/schedule`, {
      method: 'PUT',
      body: { plannedStartDate: plannedStartDate.value || null }
    })
    await refresh()
    useToast().success(plannedStartDate.value ? 'Tanggal rencana tersimpan.' : 'Tanggal rencana dihapus.')
  } catch (e) {
    useToast().error(e.data?.statusMessage || 'Gagal menyimpan tanggal')
  } finally {
    actingStatus.value = ''
  }
}

async function startProject() {
  actingStatus.value = 'start'
  try {
    await $fetch(`/api/products/${id}/start`, {
      method: 'POST',
      body: { date: todayStr(), plannedStartDate: plannedStartDate.value || null }
    })
    await refresh()
    useToast().success('Proyek dimulai.')
  } catch (e) {
    useToast().error(e.data?.statusMessage || 'Gagal memulai proyek')
  } finally {
    actingStatus.value = ''
  }
}

async function completeProject() {
  if (
    !(await useConfirm().confirm('Tandai proyek ini selesai?', {
      title: 'Selesai',
      confirmText: 'Ya, selesai',
      variant: 'primary'
    }))
  ) {
    return
  }
  actingStatus.value = 'complete'
  try {
    await $fetch(`/api/products/${id}/complete`, {
      method: 'POST',
      body: { date: todayStr() }
    })
    await refresh()
    useToast().success('Proyek selesai.')
  } catch (e) {
    useToast().error(e.data?.statusMessage || 'Gagal menyelesaikan proyek')
  } finally {
    actingStatus.value = ''
  }
}

const rabLines = computed(() => (product.value?.rab?.lines || []).map((l) => ({ ...l, source: l.source || 'rab' })))
const extraLines = computed(() => product.value?.extraLines || [])
const extraDraft = ref((product.value?.extraLines || []).map((l) => ({ ...l })))
const rabQty = ref(Object.fromEntries((product.value?.rab?.lines || []).map((l) => [l.id, l.quantity])))
const savingExtras = ref(false)
const extraError = ref('')
const extrasLocked = computed(() => projectPhase.value === 'done')
const canEditExtras = computed(() => isAdmin.value && !extrasLocked.value)
const marginPercent = computed(() => settings.value?.defaultMarginPercent ?? 40)
const priceRounding = computed(() => settings.value?.salePriceRounding ?? 500)

watch(
  () => product.value?.extraLines,
  (rows) => {
    if (!savingExtras.value) extraDraft.value = (rows || []).map((l) => ({ ...l }))
  }
)
watch(
  () => product.value?.rab?.lines,
  (rows) => {
    if (savingExtras.value) return
    rabQty.value = Object.fromEntries((rows || []).map((l) => [l.id, l.quantity]))
  }
)

const rabLive = computed(() =>
  rabLines.value.map((line) => {
    const originalQuantity = Number(line.originalQuantity ?? line.quantity) || 0
    const raw = rabQty.value[line.id]
    const quantity = Math.min(Math.max(Math.round(Number(raw ?? line.quantity) || 0), 0), originalQuantity)
    return {
      ...line,
      originalQuantity,
      quantity,
      reduced: quantity < originalQuantity,
      omitted: quantity <= 0
    }
  })
)
const scopeLines = computed(() => [...rabLive.value, ...extraDraft.value])
const goods = computed(() => catalogLines(scopeLines.value))
const jasa = computed(() => serviceLines(scopeLines.value))
const rabGoods = computed(() => catalogLines(rabLive.value))
const rabJasa = computed(() => serviceLines(rabLive.value))

const showRabPurchase = ref(false)
const rabPurchaseDraft = ref(null)
const rabPurchaseLoading = ref(false)
const rabPurchaseSaving = ref(false)
const rabPurchaseError = ref('')
const rabPurchaseForm = ref({
  date: todayStr(),
  supplier: '',
  notes: '',
  shippingFee: 0,
  platformFee: 0
})

const rabPurchaseGoodsTotal = computed(() =>
  (rabPurchaseDraft.value?.lines || []).reduce(
    (sum, line) => sum + Math.round((Number(line.quantity) || 0) * (Number(line.unitPrice) || 0)),
    0
  )
)
const rabPurchaseGrandTotal = computed(() => {
  const shipping = Math.max(Math.round(Number(rabPurchaseForm.value.shippingFee) || 0), 0)
  const platform = Math.max(Math.round(Number(rabPurchaseForm.value.platformFee) || 0), 0)
  return rabPurchaseGoodsTotal.value + shipping + platform
})
const rabPurchaseNewCount = computed(
  () => (rabPurchaseDraft.value?.lines || []).filter((line) => line.matchStatus === 'missing').length
)

async function openRabPurchase() {
  rabPurchaseError.value = ''
  rabPurchaseLoading.value = true
  showRabPurchase.value = true
  try {
    const draft = await $fetch(`/api/products/${id}/rab-purchase-draft`)
    rabPurchaseDraft.value = draft
    rabPurchaseForm.value = {
      date: todayStr(),
      supplier: draft.suggestedSupplier || suppliers.value?.[0]?.name || '',
      notes: `Kebutuhan proyek · ${draft.projectName || product.value?.name || ''}`,
      shippingFee: 0,
      platformFee: 0
    }
  } catch (e) {
    rabPurchaseError.value = e.data?.statusMessage || 'Gagal memuat kebutuhan RAB'
    rabPurchaseDraft.value = null
  } finally {
    rabPurchaseLoading.value = false
  }
}

function closeRabPurchase() {
  showRabPurchase.value = false
  rabPurchaseDraft.value = null
  rabPurchaseError.value = ''
}

async function submitRabPurchase() {
  rabPurchaseError.value = ''
  rabPurchaseSaving.value = true
  try {
    const res = await $fetch(`/api/products/${id}/purchases/from-rab`, {
      method: 'POST',
      body: {
        ...rabPurchaseForm.value,
        createMissingPackaging: true,
        category: 'packaging'
      }
    })
    closeRabPurchase()
    useToast().success(`Pembelian tercatat · ${formatIDR(res.purchase?.totalAmount || 0)}`)
  } catch (e) {
    rabPurchaseError.value = e.data?.statusMessage || 'Gagal mencatat pembelian'
  } finally {
    rabPurchaseSaving.value = false
  }
}

function setRabQty(line, value) {
  const original = Number(line.originalQuantity ?? line.quantity) || 0
  rabQty.value = {
    ...rabQty.value,
    [line.id]: Math.min(Math.max(Math.round(Number(value) || 0), 0), original)
  }
}
function omitRabLine(line) {
  setRabQty(line, 0)
}
function restoreRabLine(line) {
  setRabQty(line, line.originalQuantity ?? line.quantity)
}

function mapWageRow(w) {
  return {
    ...w,
    technicianId: w?.technicianId != null && w.technicianId !== '' ? String(w.technicianId) : ''
  }
}
const { data: technicians, refresh: refreshTechnicians } = await useFetch('/api/technicians')
const wageRows = ref((product.value?.wages || []).map(mapWageRow))
watch(
  () => product.value?.wages,
  (rows) => {
    wageRows.value = (rows || []).map(mapWageRow)
  }
)
const savingWages = ref(false)
const wageMsg = ref('')
const showTechnicians = ref(false)
const wageAssignIndex = ref(null)

function addWageRow() {
  wageRows.value.push({ technicianId: '', name: '', amount: 0 })
}

function techniciansFor(index) {
  const used = new Set(
    wageRows.value.map((r, i) => (i === index ? '' : String(r.technicianId || ''))).filter(Boolean)
  )
  return (technicians.value || []).filter((t) => !used.has(String(t.id)))
}

function onWageTechnician(row) {
  const t = (technicians.value || []).find((x) => String(x.id) === String(row.technicianId))
  row.name = t?.name || ''
}

function openTechnicians(rowIndex) {
  wageAssignIndex.value = rowIndex
  showTechnicians.value = true
}

function closeTechnicians() {
  showTechnicians.value = false
  refreshTechnicians()
}

async function onTechnicianCreated(created) {
  await refreshTechnicians()
  const idx = wageAssignIndex.value
  const row = idx != null ? wageRows.value[idx] : null
  if (row && created?.id != null) {
    row.technicianId = String(created.id)
    row.name = created.name
  }
}

const liveFinance = computed(() => summarizeProjectRevenue(scopeLines.value, wageRows.value))
const financeMargin = computed(() => {
  const revenue = liveFinance.value.revenue
  if (!revenue) return null
  return Math.round((liveFinance.value.profit / revenue) * 100)
})
const previewLines = computed(() => scopeLines.value.slice(0, 5))
const extraLineCount = computed(() => Math.max(scopeLines.value.length - previewLines.value.length, 0))

async function saveWages() {
  savingWages.value = true
  wageMsg.value = ''
  try {
    await $fetch(`/api/products/${id}/wages`, {
      method: 'PUT',
      body: { wages: wageRows.value }
    })
    await refresh()
    wageMsg.value = 'Upah teknisi tersimpan.'
    setTimeout(() => (wageMsg.value = ''), 3000)
  } catch (e) {
    useToast().error(e.data?.statusMessage || 'Gagal menyimpan upah')
  } finally {
    savingWages.value = false
  }
}

async function saveExtras() {
  extraError.value = ''
  savingExtras.value = true
  try {
    await $fetch(`/api/products/${id}/extra-lines`, {
      method: 'PUT',
      body: {
        lines: extraDraft.value,
        adjustments: rabLive.value.map((line) => ({
          customOrderLineId: line.id,
          quantity: line.quantity
        }))
      }
    })
    await refresh()
    useToast().success('Lingkup proyek tersimpan')
  } catch (e) {
    extraError.value = e.data?.statusMessage || 'Gagal menyimpan item tambahan'
  } finally {
    savingExtras.value = false
  }
}

const { data: files, refresh: refreshFiles } = await useFetch(`/api/products/${id}/files`)
const fileCount = computed(() => files.value?.length || 0)
const fileInput = ref(null)
const uploading = ref(false)
const uploadProgress = ref('')
const uploadPercent = ref(0)
const uploadError = ref('')
const previewFile = ref(files.value?.[0] || null)

const FILE_VIEW_KEY = 'ocn-product-files-view'
const filesView = ref('list')
onMounted(() => {
  const saved = localStorage.getItem(FILE_VIEW_KEY)
  if (saved === 'list' || saved === 'grid') filesView.value = saved
})
watch(filesView, (v) => {
  if (import.meta.client) localStorage.setItem(FILE_VIEW_KEY, v)
})

function fileExt(name) {
  return (String(name || '').split('.').pop() || '').toUpperCase()
}
function isModel(name) {
  return /\.(stl|obj|3mf|glb|gltf)$/i.test(name || '')
}
function isImage(name) {
  return /\.(png|jpe?g|webp|gif)$/i.test(name || '')
}
function isPdf(name) {
  return /\.pdf$/i.test(name || '')
}

function uploadOneFile(file, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    const form = new FormData()
    form.append('file', file)
    xhr.open('POST', `/api/products/${id}/files`)
    xhr.withCredentials = true
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && e.total > 0) onProgress(e.loaded / e.total)
      else onProgress(0)
    }
    xhr.onload = () => {
      let body = null
      try {
        body = xhr.responseText ? JSON.parse(xhr.responseText) : null
      } catch {
        body = null
      }
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress(1)
        resolve(body)
        return
      }
      reject(new Error(body?.statusMessage || body?.message || `Upload gagal (${xhr.status})`))
    }
    xhr.onerror = () => reject(new Error('Koneksi upload gagal'))
    xhr.onabort = () => reject(new Error('Upload dibatalkan'))
    xhr.send(form)
  })
}

async function uploadFile(event) {
  const selected = Array.from(event?.target?.files || fileInput.value?.files || [])
  if (!selected.length) return

  uploading.value = true
  uploadError.value = ''
  uploadProgress.value = ''
  uploadPercent.value = 0
  const errors = []
  let lastUploaded = null
  const total = selected.length

  try {
    for (let i = 0; i < total; i++) {
      const file = selected[i]
      uploadProgress.value =
        total === 1 ? `Mengunggah ${file.name}` : `Mengunggah ${i + 1}/${total}: ${file.name}`
      try {
        lastUploaded = await uploadOneFile(file, (ratio) => {
          uploadPercent.value = Math.min(100, Math.round(((i + ratio) / total) * 100))
        })
        uploadPercent.value = Math.min(100, Math.round(((i + 1) / total) * 100))
      } catch (e) {
        errors.push(`${file.name}: ${e.message || 'gagal'}`)
        uploadPercent.value = Math.min(100, Math.round(((i + 1) / total) * 100))
      }
    }
    await refreshFiles()
    if (lastUploaded) previewFile.value = lastUploaded
    if (errors.length) {
      uploadError.value =
        errors.length === total
          ? `Semua upload gagal.\n${errors.join('\n')}`
          : `${errors.length} dari ${total} file gagal.\n${errors.join('\n')}`
    } else if (total > 1) {
      useToast().success(`${total} file berhasil diunggah.`)
    } else if (total === 1 && lastUploaded) {
      useToast().success(`File "${lastUploaded.filename}" berhasil diunggah.`)
    }
  } finally {
    uploading.value = false
    uploadProgress.value = ''
    uploadPercent.value = 0
    if (fileInput.value) fileInput.value.value = ''
  }
}

async function deleteFile(f) {
  if (!(await useConfirm().confirm(`Hapus file "${f.filename}"?`))) return
  await $fetch(`/api/files/${f.id}`, { method: 'DELETE' })
  if (previewFile.value?.id === f.id) previewFile.value = null
  await refreshFiles()
}

const renameTarget = ref(null)
const renameName = ref('')
const renameSaving = ref(false)
const renameError = ref('')

function fileStem(name) {
  const raw = String(name || '')
  const i = raw.lastIndexOf('.')
  return i > 0 ? raw.slice(0, i) : raw
}

function openRename(f) {
  renameTarget.value = f
  renameName.value = fileStem(f.filename)
  renameError.value = ''
}

function closeRename() {
  renameTarget.value = null
  renameName.value = ''
  renameError.value = ''
}

async function saveRename() {
  const f = renameTarget.value
  if (!f) return
  renameSaving.value = true
  renameError.value = ''
  try {
    const updated = await $fetch(`/api/files/${f.id}`, {
      method: 'PUT',
      body: { filename: renameName.value }
    })
    await refreshFiles()
    if (previewFile.value?.id === f.id) previewFile.value = { ...previewFile.value, filename: updated.filename }
    closeRename()
    useToast().success('Nama file diubah.')
  } catch (e) {
    renameError.value = e.data?.statusMessage || 'Gagal mengubah nama'
  } finally {
    renameSaving.value = false
  }
}

function formatSize(bytes) {
  if (bytes >= 1024 * 1024) return (bytes / 1024 / 1024).toFixed(1) + ' MB'
  if (bytes >= 1024) return (bytes / 1024).toFixed(0) + ' KB'
  return bytes + ' B'
}

const tabs = [
  { id: 'info', label: 'Info' },
  { id: 'files', label: 'File' },
  { id: 'items', label: 'Item' },
  { id: 'revenue', label: 'Revenue' }
]
const router = useRouter()
const tab = computed({
  get() {
    const raw = String(route.query.tab || 'info')
    const mapped = raw === 'recipe' ? 'items' : raw === 'hpp' ? 'revenue' : raw
    return tabs.some((t) => t.id === mapped) ? mapped : 'info'
  },
  set(id) {
    router.replace({ query: { ...route.query, tab: id } })
  }
})
</script>

<template>
  <div class="space-y-4" v-if="product">
    <div class="flex items-start gap-2 sm:items-center sm:gap-3 flex-wrap">
      <NuxtLink to="/projects" class="text-sm text-ink-500 hover:text-accent-600 shrink-0">&larr; Proyek</NuxtLink>
      <template v-if="tab !== 'info'">
        <h1 class="text-lg sm:text-xl font-bold min-w-0 break-words flex-1">{{ product.name }}</h1>
        <span class="badge shrink-0" :class="productStatusClass(product.status)">
          {{ productStatusLabel[product.status] || product.status }}
        </span>
      </template>
    </div>

    <div class="flex gap-1 overflow-x-auto border-b border-ink-200 -mb-px">
      <button
        v-for="t in tabs"
        :key="t.id"
        type="button"
        class="shrink-0 px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors"
        :class="tab === t.id ? 'border-accent-500 text-accent-700' : 'border-transparent text-ink-500 hover:text-ink-800'"
        @click="tab = t.id"
      >
        {{ t.label }}
      </button>
    </div>

    <template v-if="tab === 'info'">
      <div class="panel overflow-hidden">
        <div class="bg-ink-900 text-ink-100 p-4 sm:p-6">
          <div class="flex items-start gap-3 sm:gap-4">
            <div
              class="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-accent-500 text-white flex items-center justify-center font-bold text-lg sm:text-xl shrink-0"
            >
              {{ initials(product.rab?.customerName || product.customerName || product.name) }}
            </div>
            <div class="min-w-0 flex-1">
              <div class="flex flex-wrap items-center gap-1.5 mb-1">
                <span class="badge" :class="productStatusClass(product.status)">
                  {{ productStatusLabel[product.status] || product.status }}
                </span>
                <span v-if="product.rab" class="badge" :class="rabStatusBadge[product.rab.status]">
                  RAB · {{ rabStatusLabel[product.rab.status] }}
                </span>
                <span v-else-if="product.erpProjectId" class="badge bg-ink-700 text-ink-200">Dari ERP</span>
                <span v-else class="badge bg-ink-700 text-ink-200">Tanpa RAB</span>
              </div>
              <h2 class="text-lg sm:text-2xl font-bold text-white break-words leading-tight">{{ product.name }}</h2>
              <p v-if="product.description" class="mt-1 text-sm text-ink-300 break-words">{{ product.description }}</p>
              <div class="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-ink-300">
                <span v-if="product.rab" class="inline-flex items-center gap-1.5">
                  <UserIcon class="w-4 h-4 text-ink-400" />{{ product.rab.customerName }}
                </span>
                <span v-else-if="product.customerName" class="inline-flex items-center gap-1.5">
                  <UserIcon class="w-4 h-4 text-ink-400" />{{ product.customerName }}
                </span>
                <span v-if="productPhase === 'waiting' && (plannedStartDate || product.plannedStartDate)" class="inline-flex items-center gap-1.5">
                  <CalendarDaysIcon class="w-4 h-4 text-ink-400" />Rencana {{ formatDate(plannedStartDate || product.plannedStartDate) }}
                </span>
                <span v-else-if="product.startedAt" class="inline-flex items-center gap-1.5">
                  <CalendarDaysIcon class="w-4 h-4 text-ink-400" />Mulai {{ formatDate(product.startedAt) }}
                </span>
                <span v-if="product.completedAt" class="inline-flex items-center gap-1.5">
                  Selesai {{ formatDate(product.completedAt) }}
                </span>
              </div>
            </div>
            <NuxtLink v-if="product.rab" :to="`/rab/${product.rab.id}`" class="btn-secondary !text-ink-800 shrink-0 hidden sm:inline-flex">
              Buka RAB
            </NuxtLink>
          </div>
        </div>

        <div class="px-4 py-3 sm:px-6 border-b border-ink-100 bg-ink-50">
          <div v-if="projectPhase === 'waiting' || projectPhase === 'pending'" class="flex flex-col sm:flex-row sm:items-end gap-3">
            <p v-if="projectPhase === 'pending'" class="text-sm text-violet-700 w-full sm:w-auto">
              Diimpor dari ERP — periksa item & upah, lalu mulai manual.
            </p>
            <div class="date-field sm:max-w-xs flex-1">
              <label class="label">Tanggal akan dimulai</label>
              <input v-model="plannedStartDate" type="date" class="input" />
            </div>
            <div class="flex flex-wrap gap-2">
              <button
                type="button"
                class="btn-secondary"
                :disabled="!!actingStatus || plannedStartDate === (product.plannedStartDate || '')"
                @click="saveSchedule"
              >
                <CheckIcon class="w-4 h-4" />{{ actingStatus === 'schedule' ? 'Menyimpan…' : 'Simpan tanggal' }}
              </button>
              <button type="button" class="btn-primary" :disabled="!!actingStatus" @click="startProject">
                <PlayIcon class="w-4 h-4" />{{ actingStatus === 'start' ? 'Memulai…' : 'Mulai' }}
              </button>
            </div>
          </div>
          <div v-else-if="projectPhase === 'in_progress'" class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <p class="text-sm text-ink-600">
              Dimulai {{ formatDate(product.startedAt) }}
              <span v-if="product.plannedStartDate" class="text-ink-400"> · rencana {{ formatDate(product.plannedStartDate) }}</span>
            </p>
            <button type="button" class="btn-primary w-full sm:w-auto" :disabled="!!actingStatus" @click="completeProject">
              <CheckCircleIcon class="w-4 h-4" />{{ actingStatus === 'complete' ? 'Menyimpan…' : 'Selesai' }}
            </button>
          </div>
          <p v-else class="text-sm text-ink-600">
            Dimulai {{ formatDate(product.startedAt) }}
            <span v-if="product.completedAt"> · selesai {{ formatDate(product.completedAt) }}</span>
          </p>
        </div>

        <div class="grid grid-cols-2 lg:grid-cols-4 divide-x divide-y lg:divide-y-0 divide-ink-100">
          <div class="p-3 sm:p-4">
            <div class="text-[10px] uppercase font-semibold tracking-wide text-ink-400">Pendapatan</div>
            <div class="mt-1 font-mono font-semibold text-base sm:text-lg text-teal-700">{{ formatIDR(liveFinance.revenue) }}</div>
            <div class="text-xs text-ink-400 mt-0.5">
              {{ goods.length }} barang · {{ jasa.length }} jasa
            </div>
          </div>
          <div class="p-3 sm:p-4">
            <div class="text-[10px] uppercase font-semibold tracking-wide text-ink-400">Modal</div>
            <div class="mt-1 font-mono font-semibold text-base sm:text-lg">{{ formatIDR(liveFinance.goodsCost) }}</div>
            <div class="text-xs text-ink-400 mt-0.5">harga pokok barang</div>
          </div>
          <div class="p-3 sm:p-4">
            <div class="text-[10px] uppercase font-semibold tracking-wide text-ink-400">Upah teknisi</div>
            <div class="mt-1 font-mono font-semibold text-base sm:text-lg">{{ formatIDR(liveFinance.wageTotal) }}</div>
            <div class="text-xs text-ink-400 mt-0.5">{{ wageRows.length }} orang</div>
          </div>
          <div class="p-3 sm:p-4">
            <div class="text-[10px] uppercase font-semibold tracking-wide text-ink-400">Laba</div>
            <div
              class="mt-1 font-mono font-semibold text-base sm:text-lg"
              :class="liveFinance.profit >= 0 ? 'text-green-700' : 'text-red-600'"
            >
              {{ formatIDR(liveFinance.profit) }}
            </div>
            <div class="text-xs text-ink-400 mt-0.5">
              {{ financeMargin == null ? 'belum ada omzet' : `margin ${financeMargin}%` }}
            </div>
          </div>
        </div>
      </div>

      <div class="flex flex-wrap gap-2">
        <NuxtLink v-if="product.rab" :to="`/rab/${product.rab.id}`" class="btn-action sm:hidden">Buka RAB</NuxtLink>
        <button type="button" class="btn-action" @click="tab = 'items'">
          <CubeIcon class="w-3.5 h-3.5" />{{ goods.length }} barang
        </button>
        <button type="button" class="btn-action" @click="tab = 'items'">
          <WrenchScrewdriverIcon class="w-3.5 h-3.5" />{{ jasa.length }} jasa
        </button>
        <button type="button" class="btn-action" @click="tab = 'files'">
          <FolderIcon class="w-3.5 h-3.5" />{{ fileCount }} file
        </button>
        <button type="button" class="btn-action" @click="tab = 'revenue'">
          <BanknotesIcon class="w-3.5 h-3.5" />Revenue
        </button>
        <button
          v-if="goods.length"
          type="button"
          class="btn-action"
          @click="openRabPurchase"
        >
          <TruckIcon class="w-3.5 h-3.5" />Beli kebutuhan
        </button>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-12 gap-3 items-start">
        <div class="panel lg:col-span-7 overflow-hidden">
          <div class="panel-header">
            <span class="panel-title">Lingkup pekerjaan</span>
            <button v-if="product.rab || extraLines.length || canEditExtras" type="button" class="text-xs text-accent-600 hover:underline" @click="tab = 'items'">
              Semua item
            </button>
          </div>
          <div v-if="product.rab || extraDraft.length" class="p-3 sm:p-4 space-y-3">
            <p v-if="product.rab?.notes" class="text-sm text-ink-600">{{ product.rab.notes }}</p>
            <div class="space-y-2">
              <div
                v-for="line in previewLines"
                :key="line.id || `${line.source}-${line.lineType}-${line.name}`"
                class="flex items-start justify-between gap-3 text-sm"
              >
                <div class="min-w-0">
                  <span class="badge mr-1" :class="rabLineTypeBadge(line.lineType)">{{ rabLineTypeLabel(line.lineType) }}</span>
                  <span v-if="line.source === 'extra'" class="badge mr-1 bg-amber-100 text-amber-800">Tambahan</span>
                  <span v-else-if="line.omitted" class="badge mr-1 bg-ink-100 text-ink-500">Dibatalkan</span>
                  <span v-else-if="line.reduced" class="badge mr-1 bg-amber-100 text-amber-800">Dikurangi</span>
                  <span class="font-medium break-words" :class="line.omitted ? 'line-through text-ink-400' : ''">{{ line.name }}</span>
                  <div class="text-xs text-ink-400 mt-0.5">
                    {{ formatNumber(line.quantity) }}{{ line.unit ? ` ${line.unit}` : '' }}
                    <span v-if="line.reduced && line.originalQuantity">
                      · RAB {{ formatNumber(line.originalQuantity) }}
                    </span>
                  </div>
                </div>
                <span class="font-mono text-ink-700 shrink-0">{{ formatIDR(lineAmount(line)) }}</span>
              </div>
              <p v-if="!previewLines.length" class="text-sm text-ink-500">Belum ada item. Tambah di tab Item.</p>
              <button
                v-if="extraLineCount"
                type="button"
                class="text-xs text-accent-600 hover:underline"
                @click="tab = 'items'"
              >
                +{{ extraLineCount }} item lagi
              </button>
            </div>
          </div>
          <div v-else class="p-6 text-sm text-ink-500 text-center">
            Proyek ini belum terkait RAB. Tambah barang dan jasa di tab Item.
          </div>
        </div>

        <div class="panel lg:col-span-5">
          <div class="panel-header"><span class="panel-title">Ubah info</span></div>
          <form class="p-3 sm:p-4 space-y-3" @submit.prevent="saveInfo">
            <div>
              <label class="label">Nama</label>
              <input v-model="info.name" class="input" required :disabled="!isAdmin" />
            </div>
            <div>
              <label class="label">Deskripsi</label>
              <textarea v-model="info.description" class="input" rows="3" :disabled="!isAdmin" placeholder="Ringkas lokasi, paket, atau catatan lapangan" />
            </div>
            <button v-if="isAdmin" type="submit" class="btn-primary w-full" :disabled="savingInfo">
              <CheckIcon class="w-4 h-4" />{{ savingInfo ? 'Menyimpan…' : 'Simpan' }}
            </button>
          </form>
        </div>
      </div>
    </template>

    <div v-else-if="tab === 'files'" class="grid grid-cols-1 lg:grid-cols-12 gap-3 items-start">
      <div class="lg:col-span-4">
        <div class="panel overflow-hidden flex flex-col lg:sticky lg:top-3">
          <div class="panel-header !flex-wrap gap-2 sticky top-0 z-10 bg-white">
            <span class="panel-title">File</span>
            <div class="flex items-center gap-1.5 ml-auto shrink-0">
              <div class="inline-flex rounded-panel border border-ink-200 overflow-hidden">
                <button
                  type="button"
                  class="p-1.5 transition-colors"
                  :class="filesView === 'list' ? 'bg-ink-100 text-ink-800' : 'text-ink-400 hover:text-ink-700 hover:bg-ink-50'"
                  title="List view"
                  aria-label="List view"
                  @click="filesView = 'list'"
                >
                  <ListBulletIcon class="w-4 h-4" />
                </button>
                <button
                  type="button"
                  class="p-1.5 transition-colors border-l border-ink-200"
                  :class="filesView === 'grid' ? 'bg-ink-100 text-ink-800' : 'text-ink-400 hover:text-ink-700 hover:bg-ink-50'"
                  title="Grid view"
                  aria-label="Grid view"
                  @click="filesView = 'grid'"
                >
                  <Squares2X2Icon class="w-4 h-4" />
                </button>
              </div>
              <label v-if="isAdmin" class="btn-secondary cursor-pointer shrink-0">
                <ArrowUpTrayIcon class="w-3.5 h-3.5" />{{ uploading ? `${uploadPercent}%` : 'Upload File' }}
                <input
                  ref="fileInput"
                  type="file"
                  accept=".stl,.obj,.3mf,.glb,.gltf,.png,.jpg,.jpeg,.webp,.gif,.pdf,.zip"
                  multiple
                  class="hidden"
                  :disabled="uploading"
                  @change="uploadFile"
                />
              </label>
            </div>
          </div>
          <div v-if="uploading" class="px-3 sm:px-4 pt-3 space-y-1.5">
            <div class="flex items-center justify-between gap-2 text-xs text-ink-500">
              <span class="truncate min-w-0">{{ uploadProgress || 'Mengunggah...' }}</span>
              <span class="font-mono shrink-0 tabular-nums">{{ uploadPercent }}%</span>
            </div>
            <div class="h-2 rounded-full bg-ink-100 overflow-hidden" role="progressbar" :aria-valuenow="uploadPercent" aria-valuemin="0" aria-valuemax="100">
              <div
                class="h-full bg-accent-500 rounded-full transition-[width] duration-150 ease-out"
                :style="{ width: Math.max(uploadPercent, 2) + '%' }"
              />
            </div>
          </div>
          <p v-if="uploadError" class="px-3 sm:px-4 pt-3 text-sm text-red-600 whitespace-pre-line">{{ uploadError }}</p>

          <div v-if="files?.length && filesView === 'list'" class="max-h-[18.75rem] overflow-y-auto overscroll-contain">
            <ul class="divide-y divide-ink-100">
              <li
                v-for="f in files"
                :key="f.id"
                class="p-3 space-y-1 cursor-pointer"
                :class="{ 'bg-accent-50': previewFile?.id === f.id }"
                @click="previewFile = f"
              >
                <div class="font-mono text-sm break-all line-clamp-2">{{ f.filename }}</div>
                <div class="text-xs text-ink-500">
                  {{ formatSize(f.sizeBytes) }} - {{ formatDate(f.createdAt) }}
                </div>
                <div class="flex items-center gap-3 flex-wrap">
                  <span
                    class="inline-flex items-center gap-1 text-xs font-medium"
                    :class="previewFile?.id === f.id ? 'text-accent-700' : 'text-accent-600'"
                  >
                    <EyeIcon class="w-3.5 h-3.5" />{{ previewFile?.id === f.id ? 'Ditampilkan' : 'Preview' }}
                  </span>
                  <a
                    :href="`/api/files/${f.id}?download=1`"
                    class="inline-flex items-center gap-1 text-xs font-medium text-teal-600 hover:text-teal-700"
                    @click.stop
                  >
                    <ArrowDownTrayIcon class="w-3.5 h-3.5" />Unduh
                  </a>
                  <button
                    v-if="isAdmin"
                    type="button"
                    class="inline-flex items-center gap-1 text-xs font-medium text-ink-600 hover:text-ink-800"
                    @click.stop="openRename(f)"
                  >
                    <PencilSquareIcon class="w-3.5 h-3.5" />Rename
                  </button>
                  <button
                    v-if="isAdmin"
                    type="button"
                    class="inline-flex items-center gap-1 text-xs font-medium text-red-500 hover:text-red-700"
                    @click.stop="deleteFile(f)"
                  >
                    <TrashIcon class="w-3.5 h-3.5" />Hapus
                  </button>
                </div>
              </li>
            </ul>
          </div>

          <div v-else-if="files?.length && filesView === 'grid'" class="max-h-[18.75rem] overflow-y-auto overscroll-contain p-2">
            <div class="grid grid-cols-2 gap-2">
              <button
                v-for="f in files"
                :key="f.id"
                type="button"
                class="text-left rounded-panel border p-2 space-y-1.5 transition-colors"
                :class="previewFile?.id === f.id ? 'border-accent-400 bg-accent-50' : 'border-ink-200 hover:border-ink-300 bg-white'"
                @click="previewFile = f"
              >
                <div
                  class="aspect-square rounded border border-ink-100 bg-ink-50 flex items-center justify-center overflow-hidden"
                  :class="previewFile?.id === f.id ? 'border-accent-200' : ''"
                >
                  <img
                    v-if="isImage(f.filename)"
                    :src="`/api/files/${f.id}`"
                    alt=""
                    class="w-full h-full object-cover"
                  />
                  <span v-else class="text-[10px] font-mono font-semibold uppercase tracking-wide text-ink-500">{{ fileExt(f.filename) }}</span>
                </div>
                <div class="font-mono text-[11px] leading-snug break-all line-clamp-2 min-h-[2rem]">{{ f.filename }}</div>
                <div class="text-[10px] text-ink-400">{{ formatSize(f.sizeBytes) }}</div>
                <div class="flex items-center gap-2 pt-0.5" @click.stop>
                  <a
                    :href="`/api/files/${f.id}?download=1`"
                    class="text-teal-600 hover:text-teal-700"
                    title="Unduh"
                    aria-label="Unduh"
                  >
                    <ArrowDownTrayIcon class="w-3.5 h-3.5" />
                  </a>
                  <button
                    v-if="isAdmin"
                    type="button"
                    class="text-ink-600 hover:text-ink-800"
                    title="Rename"
                    aria-label="Rename"
                    @click="openRename(f)"
                  >
                    <PencilSquareIcon class="w-3.5 h-3.5" />
                  </button>
                  <button
                    v-if="isAdmin"
                    type="button"
                    class="text-red-500 hover:text-red-700"
                    title="Hapus"
                    aria-label="Hapus"
                    @click="deleteFile(f)"
                  >
                    <TrashIcon class="w-3.5 h-3.5" />
                  </button>
                </div>
              </button>
            </div>
          </div>

          <p v-else class="p-4 text-sm text-ink-500">
            Belum ada file. Gambar, PDF, ZIP, atau model 3D — bisa pilih banyak file, maks 100 MB per file.
          </p>
        </div>
      </div>

      <div class="panel lg:col-span-8 overflow-hidden">
        <div class="panel-header">
          <span class="panel-title truncate min-w-0">{{ previewFile ? previewFile.filename : 'Preview' }}</span>
        </div>
        <div class="h-[42vh] sm:h-[50vh] lg:h-[70vh] bg-ink-50">
          <ClientOnly v-if="previewFile && isModel(previewFile.filename)">
            <ModelViewer
              :key="previewFile.id"
              :src="`/api/files/${previewFile.id}`"
              :filename="previewFile.filename"
              class="h-full"
            />
          </ClientOnly>
          <img
            v-else-if="previewFile && isImage(previewFile.filename)"
            :src="`/api/files/${previewFile.id}`"
            alt=""
            class="w-full h-full object-contain bg-ink-50"
          />
          <iframe
            v-else-if="previewFile && isPdf(previewFile.filename)"
            :src="`/api/files/${previewFile.id}`"
            class="w-full h-full bg-white"
            title="Preview PDF"
          />
          <div
            v-else-if="previewFile"
            class="w-full h-full flex flex-col items-center justify-center gap-3 text-sm text-ink-500 px-4 text-center"
          >
            <DocumentTextIcon class="w-10 h-10 text-ink-300" />
            <p>Tidak ada preview untuk file ini.</p>
            <a :href="`/api/files/${previewFile.id}?download=1`" class="btn-secondary">
              <ArrowDownTrayIcon class="w-4 h-4" />Unduh
            </a>
          </div>
          <div v-else class="w-full h-full flex items-center justify-center text-sm text-ink-500 px-4 text-center">
            Pilih file di panel kiri untuk melihat preview.
          </div>
        </div>
      </div>
    </div>

    <div v-else-if="tab === 'items'" class="space-y-3">
      <template v-if="product.rab">
        <div class="flex items-center justify-between gap-2">
          <p class="text-xs text-ink-500">
            Qty aktual boleh lebih kecil dari RAB (atau 0 = batal). Penawaran RAB tidak berubah. Yang nambah di panel bawah.
          </p>
          <div class="flex items-center gap-2 shrink-0">
            <button
              v-if="goods.length"
              type="button"
              class="btn-secondary"
              @click="openRabPurchase"
            >
              <TruckIcon class="w-4 h-4" />Beli kebutuhan
            </button>
            <NuxtLink :to="`/rab/${product.rab.id}`" class="text-xs text-accent-600 hover:underline">Buka RAB</NuxtLink>
            <button
              v-if="canEditExtras"
              type="button"
              class="btn-primary"
              :disabled="savingExtras"
              @click="saveExtras"
            >
              <CheckIcon class="w-4 h-4" />{{ savingExtras ? 'Menyimpan…' : 'Simpan' }}
            </button>
          </div>
        </div>

        <div class="panel overflow-hidden">
          <div class="panel-header"><span class="panel-title">Barang dari RAB</span></div>
          <div class="overflow-x-auto">
            <table class="table-std">
              <thead>
                <tr>
                  <th>Item</th>
                  <th class="text-right">Qty RAB</th>
                  <th class="text-right">Qty aktual</th>
                  <th class="text-right">Modal</th>
                  <th class="text-right">Harga jual</th>
                  <th class="text-right">Jumlah</th>
                  <th v-if="canEditExtras"></th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="line in rabGoods" :key="line.id || line.name" :class="line.omitted ? 'opacity-60' : ''">
                  <td>
                    <div class="font-medium" :class="line.omitted ? 'line-through' : ''">{{ line.name }}</div>
                    <div v-if="line.code" class="text-xs font-mono text-ink-400">{{ line.code }}</div>
                  </td>
                  <td class="num whitespace-nowrap text-ink-400">
                    {{ formatNumber(line.originalQuantity) }}{{ line.unit ? ` ${line.unit}` : '' }}
                  </td>
                  <td class="num whitespace-nowrap">
                    <input
                      v-if="canEditExtras"
                      :value="line.quantity"
                      type="number"
                      min="0"
                      :max="line.originalQuantity"
                      step="1"
                      class="input-num w-20 ml-auto"
                      @input="setRabQty(line, $event.target.value)"
                    />
                    <span v-else>
                      {{ formatNumber(line.quantity) }}{{ line.unit ? ` ${line.unit}` : '' }}
                    </span>
                  </td>
                  <td class="num">{{ formatIDR(line.costPrice) }}</td>
                  <td class="num">{{ formatIDR(line.salePrice) }}</td>
                  <td class="num">{{ formatIDR(lineAmount(line)) }}</td>
                  <td v-if="canEditExtras" class="text-right whitespace-nowrap">
                    <button
                      v-if="!line.omitted"
                      type="button"
                      class="btn-action-danger"
                      @click="omitRabLine(line)"
                    >
                      Batal
                    </button>
                    <button v-else type="button" class="btn-action" @click="restoreRabLine(line)">Pulihkan</button>
                  </td>
                </tr>
                <tr v-if="!rabGoods.length">
                  <td :colspan="canEditExtras ? 7 : 6" class="text-center text-ink-500 py-6">Tidak ada barang di RAB ini.</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div class="panel overflow-hidden">
          <div class="panel-header"><span class="panel-title">Jasa dari RAB</span></div>
          <div class="overflow-x-auto">
            <table class="table-std">
              <thead>
                <tr>
                  <th>Item</th>
                  <th class="text-right">Qty RAB</th>
                  <th class="text-right">Qty aktual</th>
                  <th class="text-right">Harga</th>
                  <th class="text-right">Jumlah</th>
                  <th v-if="canEditExtras"></th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="line in rabJasa" :key="line.id || line.name" :class="line.omitted ? 'opacity-60' : ''">
                  <td>
                    <span class="badge mr-1" :class="rabLineTypeBadge('service')">{{ rabLineTypeLabel('service') }}</span>
                    <span class="font-medium" :class="line.omitted ? 'line-through' : ''">{{ line.name }}</span>
                  </td>
                  <td class="num whitespace-nowrap text-ink-400">
                    {{ formatNumber(line.originalQuantity) }}{{ line.unit ? ` ${line.unit}` : '' }}
                  </td>
                  <td class="num whitespace-nowrap">
                    <input
                      v-if="canEditExtras"
                      :value="line.quantity"
                      type="number"
                      min="0"
                      :max="line.originalQuantity"
                      step="1"
                      class="input-num w-20 ml-auto"
                      @input="setRabQty(line, $event.target.value)"
                    />
                    <span v-else>
                      {{ formatNumber(line.quantity) }}{{ line.unit ? ` ${line.unit}` : '' }}
                    </span>
                  </td>
                  <td class="num">{{ formatIDR(line.salePrice) }}</td>
                  <td class="num">{{ formatIDR(lineAmount(line)) }}</td>
                  <td v-if="canEditExtras" class="text-right whitespace-nowrap">
                    <button
                      v-if="!line.omitted"
                      type="button"
                      class="btn-action-danger"
                      @click="omitRabLine(line)"
                    >
                      Batal
                    </button>
                    <button v-else type="button" class="btn-action" @click="restoreRabLine(line)">Pulihkan</button>
                  </td>
                </tr>
                <tr v-if="!rabJasa.length">
                  <td :colspan="canEditExtras ? 6 : 5" class="text-center text-ink-500 py-6">Tidak ada jasa di RAB ini.</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </template>
      <div v-else class="flex items-center justify-between gap-2">
        <p class="text-xs text-ink-500">Proyek ini tidak punya RAB. Item di bawah ini hanya tambahan lapangan.</p>
        <button
          v-if="goods.length"
          type="button"
          class="btn-secondary shrink-0"
          @click="openRabPurchase"
        >
          <TruckIcon class="w-4 h-4" />Beli kebutuhan
        </button>
      </div>

      <div class="panel overflow-hidden">
        <div class="panel-header">
          <span class="panel-title">Tambahan di luar RAB</span>
        </div>
        <div class="p-4 space-y-3">
          <p class="text-xs text-ink-500">
            Barang katalog, stok Produk, atau jasa yang muncul di lapangan. Tidak mengubah penawaran RAB. Stok gudang tidak terpotong otomatis.
          </p>
          <RabLinesEditor
            v-model="extraDraft"
            :disabled="!canEditExtras"
            :margin-percent="marginPercent"
            :price-rounding="priceRounding"
          />
          <p v-if="extraError" class="text-sm text-red-600">{{ extraError }}</p>
          <div v-if="canEditExtras" class="flex justify-end">
            <button type="button" class="btn-primary" :disabled="savingExtras" @click="saveExtras">
              <CheckIcon class="w-4 h-4" />{{ savingExtras ? 'Menyimpan…' : 'Simpan perubahan item' }}
            </button>
          </div>
          <p v-else-if="extrasLocked" class="text-xs text-ink-400">Proyek selesai — tambahan tidak bisa diubah.</p>
        </div>
      </div>
    </div>

    <div v-else-if="tab === 'revenue'" class="grid grid-cols-1 lg:grid-cols-2 gap-3 items-start">
      <div class="panel overflow-hidden">
        <div class="panel-header"><span class="panel-title">Revenue proyek</span></div>
        <div class="divide-y divide-ink-100">
          <div class="px-3 py-2.5 flex items-start justify-between gap-3">
            <div>
              <div class="text-sm">Pendapatan barang</div>
              <div class="text-xs text-ink-400">Harga jual item (RAB disesuaikan + tambahan)</div>
            </div>
            <div class="num text-sm">{{ formatIDR(liveFinance.goodsSale) }}</div>
          </div>
          <div class="px-3 py-2.5 flex items-start justify-between gap-3">
            <div>
              <div class="text-sm">Pendapatan jasa</div>
              <div class="text-xs text-ink-400">Harga jual pemasangan / jasa</div>
            </div>
            <div class="num text-sm">{{ formatIDR(liveFinance.serviceSale) }}</div>
          </div>
          <div class="px-3 py-2.5 flex items-center justify-between gap-3 font-medium bg-ink-50">
            <span>Total pendapatan</span>
            <span class="num">{{ formatIDR(liveFinance.revenue) }}</span>
          </div>
          <div class="px-3 py-2.5 flex items-start justify-between gap-3">
            <div>
              <div class="text-sm">Modal barang</div>
              <div class="text-xs text-ink-400">Harga pokok item katalog</div>
            </div>
            <div class="num text-sm">− {{ formatIDR(liveFinance.goodsCost) }}</div>
          </div>
          <div class="px-3 py-2.5 flex items-start justify-between gap-3">
            <div>
              <div class="text-sm">Upah teknisi</div>
              <div class="text-xs text-ink-400">Pembagian di panel kanan</div>
            </div>
            <div class="num text-sm">− {{ formatIDR(liveFinance.wageTotal) }}</div>
          </div>
          <div class="px-3 py-3 flex items-center justify-between gap-3 font-semibold bg-ink-50">
            <span>Laba proyek</span>
            <span class="num text-base" :class="liveFinance.profit >= 0 ? 'text-accent-600' : 'text-red-600'">
              {{ formatIDR(liveFinance.profit) }}
            </span>
          </div>
        </div>
        <p v-if="!product.rab && !extraLines.length" class="px-3 py-3 text-xs text-ink-400 border-t border-ink-100">
          Belum ada RAB atau item tambahan. Pendapatan 0 sampai ada baris item.
        </p>
        <p
          v-else-if="liveFinance.wageTotal > liveFinance.serviceSale"
          class="px-3 py-3 text-xs text-amber-700 border-t border-ink-100"
        >
          Upah teknisi lebih besar dari pendapatan jasa.
        </p>
      </div>

      <div class="panel overflow-hidden">
        <div class="panel-header !flex-wrap gap-2">
          <span class="panel-title">Upah teknisi</span>
          <button v-if="isAdmin" type="button" class="btn-secondary shrink-0" @click="addWageRow">
            <PlusIcon class="w-3.5 h-3.5" />Teknisi
          </button>
        </div>
        <div class="p-3 sm:p-4 space-y-3">
          <p class="text-xs text-ink-500">
            Pilih teknisi dari daftar. Tidak otomatis tercatat di Pengeluaran — catat kas terpisah jika sudah dibayar.
          </p>
          <div v-for="(row, i) in wageRows" :key="i" class="flex items-start gap-2">
            <div class="flex-1 min-w-0 space-y-2 sm:space-y-0 sm:grid sm:grid-cols-2 sm:gap-2">
              <div>
                <label class="label">Teknisi</label>
                <div class="flex gap-2 min-w-0">
                  <select
                    v-model="row.technicianId"
                    class="input min-w-0"
                    :disabled="!isAdmin"
                    @change="onWageTechnician(row)"
                  >
                    <option value="">Pilih teknisi...</option>
                    <option
                      v-if="row.name && row.technicianId && !techniciansFor(i).some((t) => String(t.id) === String(row.technicianId))"
                      :value="row.technicianId"
                    >
                      {{ row.name }}
                    </option>
                    <option v-for="t in techniciansFor(i)" :key="t.id" :value="String(t.id)">{{ t.name }}</option>
                  </select>
                  <button
                    v-if="isAdmin"
                    type="button"
                    class="btn-secondary shrink-0"
                    title="Kelola teknisi"
                    @click="openTechnicians(i)"
                  >
                    <PlusIcon class="w-4 h-4" />
                  </button>
                </div>
              </div>
              <div>
                <label class="label">Upah</label>
                <IdrInput v-model="row.amount" :disabled="!isAdmin" input-class="w-full" />
              </div>
            </div>
            <button
              v-if="isAdmin"
              type="button"
              class="text-red-500 hover:text-red-700 text-lg leading-none px-1 mt-6 shrink-0"
              @click="wageRows.splice(i, 1)"
            >
              &times;
            </button>
          </div>
          <p v-if="!wageRows.length" class="text-sm text-ink-500 text-center py-4">
            Belum ada pembagian upah. Klik "+ Teknisi".
          </p>
          <div v-if="isAdmin" class="flex flex-col sm:flex-row sm:items-center gap-2 pt-1">
            <button type="button" class="btn-primary w-full sm:w-auto" :disabled="savingWages" @click="saveWages">
              <CheckIcon class="w-4 h-4" />{{ savingWages ? 'Menyimpan…' : 'Simpan upah' }}
            </button>
            <span v-if="wageMsg" class="text-sm text-green-600">{{ wageMsg }}</span>
          </div>
        </div>
      </div>
    </div>

    <TechnicianManageModal
      v-if="showTechnicians"
      @close="closeTechnicians"
      @created="onTechnicianCreated"
      @changed="refreshTechnicians"
    />

    <AppModal v-if="showRabPurchase" title="Beli kebutuhan proyek" size="lg" @close="closeRabPurchase">
      <div v-if="rabPurchaseLoading" class="py-10 text-center text-sm text-ink-500">Memuat kebutuhan dari RAB…</div>
      <form v-else class="space-y-4" @submit.prevent="submitRabPurchase">
        <div
          v-if="rabPurchaseDraft"
          class="rounded-panel border border-sky-200 bg-sky-50 px-3 py-2.5 text-xs text-sky-900 space-y-1"
        >
          <div class="flex flex-wrap items-center gap-2">
            <span class="badge bg-white/80 text-sky-800 border border-sky-200">{{ rabPurchaseDraft.lines.length }} barang</span>
            <span v-if="rabPurchaseNewCount" class="badge bg-white/80 text-sky-800 border border-sky-200">
              {{ rabPurchaseNewCount }} produk baru
            </span>
            <span class="text-sky-800/75">Qty langsung terpakai proyek · tidak masuk stok</span>
          </div>
          <p class="text-sky-800/70">Simpan perubahan item dulu jika qty tambahan belum disimpan.</p>
        </div>

        <div v-if="rabPurchaseDraft?.lines?.length" class="panel overflow-hidden">
          <div class="panel-header">
            <span class="panel-title">Daftar barang</span>
            <span class="text-xs font-mono text-ink-500">{{ formatIDR(rabPurchaseGoodsTotal) }}</span>
          </div>
          <div class="overflow-x-auto max-h-[min(52vh,22rem)] overflow-y-auto">
            <table class="table-std text-sm">
              <thead class="sticky top-0 z-10 bg-ink-50">
                <tr>
                  <th class="min-w-[11rem]">Item</th>
                  <th class="text-right w-24">Qty</th>
                  <th class="text-right w-28">Harga</th>
                  <th class="text-right w-32">Jumlah</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="(line, i) in rabPurchaseDraft.lines"
                  :key="i"
                  class="even:bg-ink-50/50 align-top"
                >
                  <td class="py-3">
                    <div class="flex flex-wrap items-center gap-1.5 mb-1">
                      <span
                        v-if="line.matchStatus === 'matched'"
                        class="badge bg-green-100 text-green-700"
                      >
                        Gudang
                      </span>
                      <span v-else class="badge bg-sky-100 text-sky-800">Baru</span>
                      <span v-if="line.source === 'extra'" class="badge bg-amber-100 text-amber-800">Tambahan</span>
                    </div>
                    <div class="font-medium text-ink-900 leading-snug break-words">{{ line.name }}</div>
                    <div v-if="line.code" class="text-[11px] font-mono text-ink-400 mt-0.5">{{ line.code }}</div>
                  </td>
                  <td class="num whitespace-nowrap py-3">
                    <div class="font-mono text-ink-900">{{ formatNumber(line.quantity) }}</div>
                    <div v-if="line.unit" class="text-[11px] text-ink-400 font-sans normal-case">{{ line.unit }}</div>
                  </td>
                  <td class="num whitespace-nowrap py-3 text-ink-600">{{ formatIDR(line.unitPrice) }}</td>
                  <td class="num whitespace-nowrap py-3 font-medium text-ink-900">
                    {{ formatIDR(line.quantity * line.unitPrice) }}
                  </td>
                </tr>
              </tbody>
              <tfoot class="sticky bottom-0 bg-ink-100 border-t border-ink-200">
                <tr>
                  <td colspan="3" class="py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-ink-500">
                    Subtotal barang
                  </td>
                  <td class="num py-2.5 font-semibold text-ink-900">{{ formatIDR(rabPurchaseGoodsTotal) }}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div class="date-field">
            <label class="label">Tanggal</label>
            <input v-model="rabPurchaseForm.date" type="date" class="input" required />
          </div>
          <div>
            <label class="label">Supplier</label>
            <input v-model="rabPurchaseForm.supplier" class="input" required list="rab-purchase-suppliers" />
            <datalist id="rab-purchase-suppliers">
              <option v-for="s in suppliers || []" :key="s.id" :value="s.name" />
            </datalist>
          </div>
          <div>
            <label class="label">Ongkir</label>
            <IdrInput v-model="rabPurchaseForm.shippingFee" input-class="w-full" />
          </div>
          <div>
            <label class="label">Fee platform</label>
            <IdrInput v-model="rabPurchaseForm.platformFee" input-class="w-full" />
          </div>
          <div class="sm:col-span-2">
            <label class="label">Catatan</label>
            <textarea v-model="rabPurchaseForm.notes" class="input min-h-[4rem]" rows="2" />
          </div>
        </div>

        <div class="rounded-panel border border-ink-200 bg-ink-50 p-3 text-sm">
          <dl class="space-y-1.5">
            <div class="flex justify-between gap-4">
              <dt class="text-ink-500">Subtotal barang</dt>
              <dd class="font-mono">{{ formatIDR(rabPurchaseGoodsTotal) }}</dd>
            </div>
            <div v-if="rabPurchaseForm.shippingFee" class="flex justify-between gap-4">
              <dt class="text-ink-500">Ongkir</dt>
              <dd class="font-mono">{{ formatIDR(rabPurchaseForm.shippingFee) }}</dd>
            </div>
            <div v-if="rabPurchaseForm.platformFee" class="flex justify-between gap-4">
              <dt class="text-ink-500">Fee platform</dt>
              <dd class="font-mono">{{ formatIDR(rabPurchaseForm.platformFee) }}</dd>
            </div>
            <div class="flex justify-between gap-4 border-t border-ink-200 pt-2 font-semibold">
              <dt>Total pembelian</dt>
              <dd class="font-mono text-base">{{ formatIDR(rabPurchaseGrandTotal) }}</dd>
            </div>
          </dl>
        </div>

        <p v-if="rabPurchaseError" class="text-sm text-red-600">{{ rabPurchaseError }}</p>
        <div class="flex justify-end gap-2">
          <button type="button" class="btn-secondary" @click="closeRabPurchase"><XMarkIcon class="w-4 h-4" />Batal</button>
          <button
            type="submit"
            class="btn-primary"
            :disabled="rabPurchaseSaving || !rabPurchaseDraft?.lines?.length"
          >
            <CheckIcon class="w-4 h-4" />{{ rabPurchaseSaving ? 'Mencatat…' : 'Catat pembelian' }}
          </button>
        </div>
      </form>
    </AppModal>

    <AppModal v-if="renameTarget" title="Rename file" @close="closeRename">
      <form class="space-y-3" @submit.prevent="saveRename">
        <div>
          <label class="label">Nama</label>
          <div class="flex items-center gap-2">
            <input v-model="renameName" class="input flex-1" required maxlength="160" />
            <span class="font-mono text-sm text-ink-500 shrink-0">.{{ fileExt(renameTarget.filename).toLowerCase() }}</span>
          </div>
          <p class="text-xs text-ink-400 mt-1">Ekstensi tidak diubah agar preview tetap jalan.</p>
        </div>
        <p v-if="renameError" class="text-sm text-red-600">{{ renameError }}</p>
        <div class="flex justify-end gap-2">
          <button type="button" class="btn-secondary" @click="closeRename"><XMarkIcon class="w-4 h-4" />Batal</button>
          <button type="submit" class="btn-primary" :disabled="renameSaving">
            <CheckIcon class="w-4 h-4" />{{ renameSaving ? 'Menyimpan…' : 'Simpan' }}
          </button>
        </div>
      </form>
    </AppModal>
  </div>
</template>
