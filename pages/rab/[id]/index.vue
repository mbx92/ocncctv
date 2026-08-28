<script setup>
import {
  ArrowLeftIcon,
  ArrowUpTrayIcon,
  ArrowDownTrayIcon,
  TrashIcon,
  CheckIcon,
  PencilSquareIcon,
  XMarkIcon,
  PaperAirplaneIcon,
  FolderIcon,
  DocumentTextIcon
} from '@heroicons/vue/24/outline'
import { rabStatusLabel, rabStatusBadge, rabIsLocked, rabLineTypeBadge, rabLineTypeLabel, lineAmount } from '~/utils/rab.js'

const route = useRoute()
const id = route.params.id
const { data: order, refresh } = await useFetch(`/api/custom-orders/${id}`)
const { data: settings } = await useFetch('/api/settings')

const fileInput = ref(null)
const uploading = ref(false)
const uploadError = ref('')
const editing = ref(false)
const form = ref({})
const lineDraft = ref([])
const saving = ref(false)
const savingLines = ref(false)
const acting = ref('')
const errorMsg = ref('')
const lineError = ref('')

const files = computed(() => order.value?.files || [])
const locked = computed(() => rabIsLocked(order.value?.status))
const canEdit = computed(() => order.value && !locked.value)
const marginPercent = computed(() => settings.value?.defaultMarginPercent ?? 40)
const priceRounding = computed(() => settings.value?.salePriceRounding ?? 500)

watch(
  () => order.value?.lines,
  (lines) => {
    if (!savingLines.value) lineDraft.value = (lines || []).map((l) => ({ ...l }))
  },
  { immediate: true }
)

function isModel(name) {
  return /\.(stl|obj|3mf|glb|gltf)$/i.test(name || '')
}
function isImage(name) {
  return /\.(png|jpe?g|webp)$/i.test(name || '')
}
function formatSize(bytes) {
  if (bytes >= 1024 * 1024) return (bytes / 1024 / 1024).toFixed(1) + ' MB'
  if (bytes >= 1024) return (bytes / 1024).toFixed(0) + ' KB'
  return bytes + ' B'
}

function startEdit() {
  const o = order.value
  form.value = {
    date: o.date,
    customerName: o.customerName,
    title: o.title,
    notes: o.notes || ''
  }
  errorMsg.value = ''
  editing.value = true
}

async function saveEdit() {
  saving.value = true
  errorMsg.value = ''
  try {
    await $fetch(`/api/custom-orders/${id}`, { method: 'PUT', body: form.value })
    editing.value = false
    await refresh()
  } catch (e) {
    errorMsg.value = e.data?.statusMessage || 'Gagal menyimpan'
  } finally {
    saving.value = false
  }
}

async function persistLines() {
  lineError.value = ''
  savingLines.value = true
  try {
    await $fetch(`/api/custom-orders/${id}`, {
      method: 'PUT',
      body: {
        date: order.value.date,
        customerName: order.value.customerName,
        title: order.value.title,
        notes: order.value.notes || '',
        lines: lineDraft.value
      }
    })
    await refresh()
    return true
  } catch (e) {
    lineError.value = e.data?.statusMessage || 'Gagal menyimpan baris'
    return false
  } finally {
    savingLines.value = false
  }
}

async function saveLines() {
  if (await persistLines()) useToast().success('Baris RAB tersimpan')
}

async function markSent() {
  if (!(await persistLines())) return
  acting.value = 'sent'
  try {
    await $fetch(`/api/custom-orders/${id}/send`, { method: 'POST' })
    await refresh()
    useToast().success('RAB ditandai dikirim')
  } catch (e) {
    useToast().error(e.data?.statusMessage || 'Gagal menandai dikirim')
  } finally {
    acting.value = ''
  }
}

async function markDeal() {
  if (!(await persistLines())) return
  const ok = await useConfirm().confirm(
    `Deal RAB "${order.value.title}"? Akan dibuat proyek baru. Kas dan stok belum berubah.`,
    { title: 'Deal jadi proyek', confirmText: 'Ya, Deal', variant: 'primary' }
  )
  if (!ok) return
  acting.value = 'deal'
  try {
    const updated = await $fetch(`/api/custom-orders/${id}/deal`, { method: 'POST' })
    useToast().success('Proyek dibuat dari RAB')
    await navigateTo(`/projects/${updated.projectId || updated.project?.id}`)
  } catch (e) {
    useToast().error(e.data?.statusMessage || 'Gagal Deal')
  } finally {
    acting.value = ''
  }
}

async function markLost() {
  const ok = await useConfirm().confirm(
    `Tandai RAB "${order.value.title}" sebagai Tidak deal?`,
    { title: 'Tidak deal', confirmText: 'Ya, tandai', variant: 'warning' }
  )
  if (!ok) return
  acting.value = 'lost'
  try {
    await $fetch(`/api/custom-orders/${id}/lost`, { method: 'POST' })
    await refresh()
    useToast().success('RAB ditandai Tidak deal')
  } catch (e) {
    useToast().error(e.data?.statusMessage || 'Gagal menandai')
  } finally {
    acting.value = ''
  }
}

function uploadOne(file) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    const data = new FormData()
    data.append('file', file)
    xhr.open('POST', `/api/custom-orders/${id}/files`)
    xhr.withCredentials = true
    xhr.onload = () => {
      let body = null
      try {
        body = xhr.responseText ? JSON.parse(xhr.responseText) : null
      } catch {
        body = null
      }
      if (xhr.status >= 200 && xhr.status < 300) resolve(body)
      else reject(new Error(body?.statusMessage || `Upload gagal (${xhr.status})`))
    }
    xhr.onerror = () => reject(new Error('Koneksi upload gagal'))
    xhr.send(data)
  })
}

async function uploadFiles(event) {
  const selected = Array.from(event?.target?.files || [])
  if (!selected.length) return
  uploading.value = true
  uploadError.value = ''
  const errors = []
  for (const file of selected) {
    try {
      await uploadOne(file)
    } catch (e) {
      errors.push(`${file.name}: ${e.message}`)
    }
  }
  if (fileInput.value) fileInput.value.value = ''
  if (errors.length) uploadError.value = errors.join('\n')
  uploading.value = false
  await refresh()
}

async function deleteFile(f) {
  if (!(await useConfirm().confirm(`Hapus file "${f.filename}"?`, { title: 'Hapus file' }))) return
  await $fetch(`/api/custom-order-files/${f.id}`, { method: 'DELETE' })
  await refresh()
}
</script>

<template>
  <div v-if="order" class="space-y-4">
    <div class="flex items-start gap-3">
      <NuxtLink to="/rab" class="btn-secondary mt-0.5"><ArrowLeftIcon class="w-4 h-4" /></NuxtLink>
      <div class="min-w-0 flex-1">
        <h1 class="text-xl font-bold break-words">{{ order.title }}</h1>
        <p class="text-sm text-ink-500">{{ order.customerName }} · {{ formatDate(order.date) }}</p>
      </div>
      <span class="badge shrink-0" :class="rabStatusBadge[order.status]">{{ rabStatusLabel[order.status] }}</span>
    </div>

    <div class="flex flex-wrap gap-2">
      <NuxtLink :to="`/rab/${order.id}/quote`" class="btn-secondary">
        <DocumentTextIcon class="w-4 h-4" />Tampilan pelanggan
      </NuxtLink>
      <template v-if="canEdit">
        <button v-if="order.status !== 'sent'" class="btn-secondary" :disabled="!!acting" @click="markSent">
          <PaperAirplaneIcon class="w-4 h-4" />{{ acting === 'sent' ? 'Menandai…' : 'Tandai dikirim' }}
        </button>
        <button class="btn-primary" :disabled="!!acting" @click="markDeal">
          <FolderIcon class="w-4 h-4" />{{ acting === 'deal' ? 'Membuat proyek…' : 'Deal' }}
        </button>
        <button class="btn-secondary" :disabled="!!acting" @click="markLost">
          {{ acting === 'lost' ? 'Menandai…' : 'Tidak deal' }}
        </button>
      </template>
    </div>

    <div
      v-if="order.projectId || order.project"
      class="panel p-3 flex items-center justify-between gap-2"
    >
      <div class="text-sm">
        <div class="text-xs uppercase font-semibold text-ink-400">Proyek</div>
        <div class="font-medium">{{ order.project?.name || order.title }}</div>
      </div>
      <NuxtLink :to="`/projects/${order.projectId || order.project.id}`" class="btn-secondary">
        Buka proyek
      </NuxtLink>
    </div>

    <div class="panel">
      <div class="panel-header flex items-center justify-between">
        <span class="panel-title">Data RAB</span>
        <button v-if="canEdit && !editing" class="btn-secondary" @click="startEdit">
          <PencilSquareIcon class="w-3.5 h-3.5" />Edit
        </button>
      </div>

      <form v-if="editing" class="p-4 space-y-3" @submit.prevent="saveEdit">
        <div class="date-field">
          <label class="label">Tanggal</label>
          <input v-model="form.date" type="date" class="input" required />
        </div>
        <div>
          <label class="label">Nama pelanggan</label>
          <input v-model="form.customerName" class="input" required />
        </div>
        <div>
          <label class="label">Judul pekerjaan</label>
          <input v-model="form.title" class="input" required />
        </div>
        <div>
          <label class="label">Catatan</label>
          <input v-model="form.notes" class="input" />
        </div>
        <p v-if="errorMsg" class="text-sm text-red-600">{{ errorMsg }}</p>
        <div class="flex justify-end gap-2">
          <button type="button" class="btn-secondary" @click="editing = false"><XMarkIcon class="w-4 h-4" />Batal</button>
          <button type="submit" class="btn-primary" :disabled="saving">
            <CheckIcon class="w-4 h-4" />{{ saving ? 'Menyimpan…' : 'Simpan' }}
          </button>
        </div>
      </form>

      <div v-else class="p-4 space-y-1 text-sm">
        <div class="flex justify-between gap-2"><span class="text-ink-500">Pelanggan</span><span>{{ order.customerName }}</span></div>
        <div class="flex justify-between gap-2"><span class="text-ink-500">Tanggal</span><span class="font-mono">{{ formatDate(order.date) }}</span></div>
        <p v-if="order.notes" class="text-ink-500 pt-2">{{ order.notes }}</p>
      </div>
    </div>

    <div class="panel">
      <div class="panel-header">
        <span class="panel-title">Baris penawaran</span>
      </div>
      <div class="p-4 space-y-3">
        <RabLinesEditor
          v-if="canEdit"
          v-model="lineDraft"
          :margin-percent="marginPercent"
          :price-rounding="priceRounding"
        />
        <template v-else>
          <div class="space-y-2">
            <div
              v-for="line in order.lines"
              :key="line.id || `${line.lineType}-${line.name}`"
              class="flex flex-col sm:flex-row sm:items-start justify-between gap-1 text-sm border-b border-ink-100 pb-2 last:border-0"
            >
              <div class="min-w-0">
                <span class="badge mr-1" :class="rabLineTypeBadge(line.lineType)">
                  {{ rabLineTypeLabel(line.lineType) }}
                </span>
                <span class="font-medium break-words">{{ line.name }}</span>
                <div v-if="line.code" class="text-xs font-mono text-ink-400">{{ line.code }}</div>
                <div class="text-xs text-ink-400">
                  {{ formatNumber(line.quantity) }}{{ line.unit ? ` ${line.unit}` : '' }} × {{ formatIDR(line.salePrice) }}
                  <span v-if="line.lineType !== 'service' && line.costPrice">
                    · modal {{ formatIDR(line.costPrice) }}
                  </span>
                  <span v-else-if="line.lineType === 'service'"> · tanpa stok</span>
                </div>
              </div>
              <span class="font-mono shrink-0">{{ formatIDR(lineAmount(line)) }}</span>
            </div>
            <p v-if="!(order.lines || []).length" class="text-sm text-ink-500">Belum ada baris.</p>
          </div>
          <div class="flex flex-wrap justify-end gap-x-4 gap-y-1 text-sm pt-1">
            <span class="text-ink-500">Modal {{ formatIDR(order.totalCost) }}</span>
            <span class="font-medium">Jual {{ formatIDR(order.totalSale) }}</span>
            <span :class="(order.margin || 0) >= 0 ? 'text-green-700' : 'text-red-600'">
              Margin {{ formatIDR(order.margin) }}
            </span>
          </div>
        </template>
        <p v-if="lineError" class="text-sm text-red-600">{{ lineError }}</p>
        <div v-if="canEdit" class="flex justify-end">
          <button type="button" class="btn-primary" :disabled="savingLines" @click="saveLines">
            <CheckIcon class="w-4 h-4" />{{ savingLines ? 'Menyimpan…' : 'Simpan baris' }}
          </button>
        </div>
      </div>
    </div>

    <div class="panel">
      <div class="panel-header flex items-center justify-between">
        <span class="panel-title">File</span>
        <label v-if="canEdit" class="btn-secondary cursor-pointer">
          <ArrowUpTrayIcon class="w-3.5 h-3.5" />{{ uploading ? 'Mengunggah…' : 'Unggah' }}
          <input ref="fileInput" type="file" multiple class="hidden" :disabled="uploading" @change="uploadFiles" />
        </label>
      </div>
      <p class="px-4 pt-3 text-xs text-ink-500">Gambar, PDF, atau ZIP. Maks 100 MB per file.</p>
      <p v-if="uploadError" class="px-4 pt-2 text-sm text-red-600 whitespace-pre-line">{{ uploadError }}</p>
      <ul v-if="files.length" class="divide-y divide-ink-100">
        <li v-for="f in files" :key="f.id" class="p-4 space-y-2">
          <div class="flex items-start justify-between gap-2">
            <div class="min-w-0">
              <div class="font-mono text-sm break-all">{{ f.filename }}</div>
              <div class="text-xs text-ink-400">{{ formatSize(f.sizeBytes) }}</div>
            </div>
            <div class="flex gap-2 shrink-0">
              <a :href="`/api/custom-order-files/${f.id}?download=1`" class="text-xs text-teal-600">
                <ArrowDownTrayIcon class="w-4 h-4 inline" /> Unduh
              </a>
              <button v-if="canEdit" class="text-xs text-red-500" @click="deleteFile(f)">
                <TrashIcon class="w-4 h-4 inline" /> Hapus
              </button>
            </div>
          </div>
          <img
            v-if="isImage(f.filename)"
            :src="`/api/custom-order-files/${f.id}`"
            alt=""
            class="max-h-48 rounded border border-ink-200 object-contain bg-ink-50"
          />
          <ClientOnly v-else-if="isModel(f.filename)">
            <ModelViewer
              :src="`/api/custom-order-files/${f.id}`"
              :filename="f.filename"
              compact
              class="h-56 rounded border border-ink-200"
            />
          </ClientOnly>
        </li>
      </ul>
      <p v-else class="p-6 text-sm text-ink-500 text-center">Belum ada file.</p>
    </div>
  </div>
</template>
