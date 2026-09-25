<script setup>
import { ArrowLeftIcon, ArrowPathIcon, ExclamationTriangleIcon, PrinterIcon, ArrowDownTrayIcon, ShareIcon, ClipboardDocumentIcon } from '@heroicons/vue/24/outline'
import { parseQuoteStyle } from '~/utils/quoteStyle.js'

definePageMeta({ layout: 'print' })

const route = useRoute()
const router = useRouter()
const { data: invoice, error, refresh } = await useFetch(`/api/sales/${route.params.id}`)
const isAdmin = computed(() => useState('authUser').value?.role === 'admin')
const recallingSale = ref(false)

async function recallSale() {
  if (!invoice.value?.id || recallingSale.value) return
  recallingSale.value = true
  try {
    await $fetch(`/api/sales/${invoice.value.id}/resync`, { method: 'POST' })
    await refresh()
    useToast().success('Perhitungan penjualan diperbarui dari lingkup terbaru.')
  } catch (e) {
    useToast().error(e.data?.statusMessage || 'Gagal menghitung ulang penjualan')
  } finally {
    recallingSale.value = false
  }
}

async function keepSaleInvoice() {
  if (!invoice.value?.id || recallingSale.value) return
  recallingSale.value = true
  try {
    await $fetch(`/api/sales/${invoice.value.id}/keep-invoice`, { method: 'POST' })
    await refresh()
    useToast().success('Nilai invoice dikunci sesuai yang sudah diterbitkan.')
  } catch (e) {
    useToast().error(e.data?.statusMessage || 'Gagal mengunci nilai invoice')
  } finally {
    recallingSale.value = false
  }
}

const invoiceStyle = computed({
  get: () => parseQuoteStyle(route.query.tampilan),
  set(value) {
    const query = { ...route.query }
    if (value === 'resmi') query.tampilan = 'resmi'
    else delete query.tampilan
    router.replace({ query })
  }
})

useHead({
  title: computed(() => (invoice.value ? `Invoice ${invoice.value.invoiceNumber}` : 'Invoice'))
})

const pdfBusy = ref(false)
const shareBusy = ref(false)
const shareInfo = ref(null)

function printInvoice() {
  if (import.meta.client) window.print()
}

async function downloadPdf(url, filename) {
  pdfBusy.value = true
  try {
    const blob = await $fetch(url, { responseType: 'blob' })
    const href = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = href
    a.download = filename
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

async function shareInvoice() {
  shareBusy.value = true
  try {
    const res = await $fetch(`/api/sales/${route.params.id}/share`, { method: 'POST' })
    const qs = invoiceStyle.value === 'resmi' ? '?tampilan=resmi' : ''
    const url = `${window.location.origin}${res.path}${qs}`
    shareInfo.value = { url, expiresAt: res.expiresAt, reused: res.reused }
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Invoice ${invoice.value?.invoiceNumber || ''}`,
          text: `Invoice ${invoice.value?.invoiceNumber || ''}`,
          url
        })
        return
      } catch (e) {
        if (e?.name === 'AbortError') return
      }
    }
    await navigator.clipboard.writeText(url)
    useToast().success('Tautan invoice disalin.')
  } catch (e) {
    useToast().error(e.data?.statusMessage || 'Gagal membuat tautan')
  } finally {
    shareBusy.value = false
  }
}

function formatShareExpiry(value) {
  const dt = new Date(value)
  if (Number.isNaN(dt.getTime())) return formatDate(value)
  return dt.toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })
}

async function copyShareUrl() {
  if (!shareInfo.value?.url) return
  await navigator.clipboard.writeText(shareInfo.value.url)
  useToast().success('Tautan disalin.')
}
</script>

<template>
  <div class="min-h-screen bg-ink-100 print:bg-white">
    <div class="no-print sticky top-0 z-10 flex flex-col gap-2 px-3 py-2.5 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:px-4 sm:py-3 bg-ink-900 text-ink-100 print:hidden">
      <NuxtLink to="/sales" class="inline-flex items-center gap-1 text-sm hover:text-white">
        <ArrowLeftIcon class="w-4 h-4" /> Penjualan
      </NuxtLink>
      <div class="flex flex-wrap items-center gap-2">
        <QuoteStyleToggle v-model="invoiceStyle" />
        <button class="btn-secondary !text-ink-800" type="button" @click="printInvoice">
          <PrinterIcon class="w-4 h-4" />Cetak
        </button>
        <button
          class="btn-secondary !text-ink-800"
          type="button"
          :disabled="pdfBusy || !invoice"
          @click="downloadPdf(`/api/sales/${route.params.id}/pdf${invoiceStyle === 'resmi' ? '?tampilan=resmi' : ''}`, `${invoice?.invoiceNumber || 'invoice'}.pdf`)"
        >
          <ArrowDownTrayIcon class="w-4 h-4" />{{ pdfBusy ? 'Mengunduh…' : 'PDF' }}
        </button>
        <button class="btn-primary" type="button" :disabled="shareBusy || !invoice" @click="shareInvoice">
          <ShareIcon class="w-4 h-4" />{{ shareBusy ? 'Membuat…' : 'Bagikan' }}
        </button>
      </div>
    </div>

    <p v-if="error" class="p-6 text-sm text-red-600">{{ error.data?.statusMessage || 'Invoice tidak ditemukan' }}</p>

    <div
      v-if="invoice?.saleOutOfSync"
      class="no-print mx-auto mt-4 w-full sm:w-[210mm] max-w-full px-4 print:hidden"
    >
      <div class="rounded-panel border border-amber-200 bg-amber-50 p-3 flex flex-col sm:flex-row sm:items-center gap-3">
        <div class="flex items-start gap-2 min-w-0">
          <ExclamationTriangleIcon class="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
          <p class="text-sm text-amber-950">
            Lingkup proyek berubah setelah invoice ini dicatat ({{ formatIDR(invoice.saleRecorded) }}).
            Tagihan dari item yang dipakai sekarang {{ formatIDR(invoice.subtotal) }}.
            Kunci nilai invoice jika sudah dibayar, atau hitung ulang jika belum ditagih.
          </p>
        </div>
        <div v-if="isAdmin" class="flex flex-wrap gap-2 shrink-0">
          <button type="button" class="btn-secondary" :disabled="recallingSale" @click="keepSaleInvoice">
            Tetap nilai invoice
          </button>
          <button type="button" class="btn-secondary" :disabled="recallingSale" @click="recallSale">
            <ArrowPathIcon class="w-4 h-4" :class="recallingSale ? 'animate-spin' : ''" />
            {{ recallingSale ? 'Menyimpan…' : 'Hitung ulang' }}
          </button>
        </div>
      </div>
    </div>

    <div v-if="shareInfo" class="no-print mx-auto mt-4 w-full sm:w-[210mm] max-w-full px-4 print:hidden">
      <div class="rounded-panel border border-ink-200 bg-white p-3 text-sm space-y-2">
        <div class="text-xs font-semibold uppercase tracking-wide text-ink-500">Tautan publik</div>
        <div class="flex gap-2">
          <input :value="shareInfo.url" readonly class="input font-mono text-xs" @focus="$event.target.select()" />
          <button type="button" class="btn-secondary shrink-0" @click="copyShareUrl"><ClipboardDocumentIcon class="w-4 h-4" />Salin</button>
        </div>
        <p class="text-xs text-ink-500">Berlaku sampai {{ formatShareExpiry(shareInfo.expiresAt) }}.</p>
      </div>
    </div>

    <InvoiceOfficialSheet v-if="invoice && invoiceStyle === 'resmi'" :invoice="invoice" />
    <InvoiceSheet v-else-if="invoice" :invoice="invoice" />
  </div>
</template>
