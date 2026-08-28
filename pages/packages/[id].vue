<script setup>
import {
  ArrowLeftIcon,
  ArrowPathIcon,
  ShareIcon,
  ClipboardDocumentIcon,
  CheckIcon,
  ArrowDownTrayIcon
} from '@heroicons/vue/24/outline'

const route = useRoute()
const id = route.params.id
const { data: pkg, refresh } = await useFetch(`/api/packages/${id}`)
const { data: settings } = await useFetch('/api/settings')

const form = ref({
  name: pkg.value?.name || '',
  description: pkg.value?.description || '',
  notes: pkg.value?.notes || ''
})
const lineDraft = ref([...(pkg.value?.lines || [])])
const saving = ref(false)
const syncing = ref(false)
const shareBusy = ref(false)
const pdfBusy = ref(false)
const shareInfo = ref(null)
const errorMsg = ref('')

const marginPercent = computed(() => settings.value?.defaultMarginPercent ?? 40)
const priceRounding = computed(() => settings.value?.salePriceRounding ?? 500)

watch(
  () => pkg.value && `${pkg.value.id}|${pkg.value.name}`,
  () => {
    if (!pkg.value || saving.value) return
    form.value = {
      name: pkg.value.name,
      description: pkg.value.description || '',
      notes: pkg.value.notes || ''
    }
    lineDraft.value = [...(pkg.value.lines || [])]
  }
)

async function save() {
  errorMsg.value = ''
  saving.value = true
  try {
    await $fetch(`/api/packages/${id}`, {
      method: 'PUT',
      body: { ...form.value, lines: lineDraft.value }
    })
    await refresh()
    useToast().success('Paket tersimpan.')
  } catch (e) {
    errorMsg.value = e.data?.statusMessage || 'Gagal menyimpan'
  } finally {
    saving.value = false
  }
}

async function syncPrices() {
  syncing.value = true
  try {
    await $fetch(`/api/packages/${id}`, {
      method: 'PUT',
      body: { ...form.value, lines: lineDraft.value }
    })
    await $fetch(`/api/packages/${id}/sync`, { method: 'POST' })
    await refresh()
    lineDraft.value = [...(pkg.value?.lines || [])]
    useToast().success('Harga diperbarui dari katalog dan produk.')
  } catch (e) {
    useToast().error(e.data?.statusMessage || 'Gagal sync harga')
  } finally {
    syncing.value = false
  }
}

async function sharePackage() {
  shareBusy.value = true
  try {
    await $fetch(`/api/packages/${id}`, {
      method: 'PUT',
      body: { ...form.value, lines: lineDraft.value }
    })
    await refresh()
    const res = await $fetch(`/api/packages/${id}/share`, { method: 'POST' })
    const url = `${window.location.origin}${res.path}`
    shareInfo.value = { url, expiresAt: res.expiresAt }
    if (navigator.share) {
      try {
        await navigator.share({
          title: form.value.name,
          text: `Paket ${form.value.name}`,
          url
        })
        return
      } catch (e) {
        if (e?.name === 'AbortError') return
      }
    }
    await navigator.clipboard.writeText(url)
    useToast().success('Tautan paket disalin.')
  } catch (e) {
    useToast().error(e.data?.statusMessage || 'Gagal membuat tautan')
  } finally {
    shareBusy.value = false
  }
}

async function copyShareUrl() {
  if (!shareInfo.value?.url) return
  await navigator.clipboard.writeText(shareInfo.value.url)
  useToast().success('Tautan disalin.')
}

function formatShareExpiry(value) {
  const dt = new Date(value)
  if (Number.isNaN(dt.getTime())) return formatDate(value)
  return dt.toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })
}

async function downloadPdf() {
  pdfBusy.value = true
  try {
    const blob = await $fetch(`/api/packages/${id}/quote/pdf`, { responseType: 'blob' })
    const href = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = href
    a.download = `PKT-${String(id).padStart(4, '0')}.pdf`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(href)
  } catch (e) {
    useToast().error(e.data?.statusMessage || 'Gagal mengunduh PDF')
  } finally {
    pdfBusy.value = false
  }
}
</script>

<template>
  <div class="space-y-4">
    <div class="flex flex-wrap items-center justify-between gap-2">
      <NuxtLink to="/packages" class="inline-flex items-center gap-1 text-sm text-ink-500 hover:text-ink-800">
        <ArrowLeftIcon class="w-4 h-4" /> Paket
      </NuxtLink>
      <div class="flex flex-wrap gap-2">
        <button type="button" class="btn-secondary" :disabled="syncing" @click="syncPrices">
          <ArrowPathIcon class="w-4 h-4" />{{ syncing ? 'Sync…' : 'Sync harga' }}
        </button>
        <button type="button" class="btn-secondary" :disabled="pdfBusy" @click="downloadPdf">
          <ArrowDownTrayIcon class="w-4 h-4" />PDF
        </button>
        <button type="button" class="btn-primary" :disabled="shareBusy" @click="sharePackage">
          <ShareIcon class="w-4 h-4" />{{ shareBusy ? 'Membuat…' : 'Bagikan' }}
        </button>
      </div>
    </div>

    <div v-if="shareInfo" class="panel p-3 text-sm space-y-2">
      <div class="text-xs font-semibold uppercase tracking-wide text-ink-500">Tautan publik</div>
      <div class="flex gap-2">
        <input :value="shareInfo.url" readonly class="input font-mono text-xs" @focus="$event.target.select()" />
        <button type="button" class="btn-secondary shrink-0" @click="copyShareUrl">
          <ClipboardDocumentIcon class="w-4 h-4" />Salin
        </button>
      </div>
      <p class="text-xs text-ink-500">Berlaku sampai {{ formatShareExpiry(shareInfo.expiresAt) }}.</p>
    </div>

    <div class="panel p-3 sm:p-4 space-y-3">
      <div>
        <label class="label">Nama paket</label>
        <input v-model="form.name" class="input" required />
      </div>
      <div>
        <label class="label">Deskripsi (tampil di tautan pelanggan)</label>
        <input v-model="form.description" class="input" placeholder="opsional" />
      </div>
    </div>

    <div class="panel">
      <div class="panel-header">
        <span class="panel-title">Isi paket</span>
      </div>
      <div class="p-3 sm:p-4">
        <RabLinesEditor
          v-model="lineDraft"
          :margin-percent="marginPercent"
          :price-rounding="priceRounding"
        />
      </div>
    </div>

    <p v-if="errorMsg" class="text-sm text-red-600">{{ errorMsg }}</p>
    <div class="flex gap-2">
      <button type="button" class="btn-primary" :disabled="saving" @click="save">
        <CheckIcon class="w-4 h-4" />{{ saving ? 'Menyimpan…' : 'Simpan paket' }}
      </button>
    </div>
  </div>
</template>
