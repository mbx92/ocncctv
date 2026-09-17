<script setup>
import { PrinterIcon, ArrowDownTrayIcon } from '@heroicons/vue/24/outline'
import { parseQuoteStyle } from '~/utils/quoteStyle.js'

definePageMeta({ layout: 'print' })

const route = useRoute()
const router = useRouter()
const { data: invoice, error } = await useFetch(`/api/public/invoices/${route.params.token}`)

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

function printInvoice() {
  if (import.meta.client) window.print()
}

async function downloadPdf() {
  if (!invoice.value) return
  pdfBusy.value = true
  try {
    const blob = await $fetch(
      `/api/public/invoices/${route.params.token}/pdf${invoiceStyle.value === 'resmi' ? '?tampilan=resmi' : ''}`,
      { responseType: 'blob' }
    )
    const href = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = href
    a.download = `${invoice.value.invoiceNumber}.pdf`
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
  <div class="min-h-screen bg-ink-100 print:bg-white">
    <div class="no-print sticky top-0 z-10 flex flex-wrap items-center justify-end gap-2 px-3 py-2.5 sm:px-4 sm:py-3 bg-ink-900 text-ink-100 print:hidden">
      <QuoteStyleToggle v-model="invoiceStyle" />
      <button class="btn-secondary !text-ink-800" type="button" @click="printInvoice">
        <PrinterIcon class="w-4 h-4" />Cetak
      </button>
      <button class="btn-primary" type="button" :disabled="pdfBusy || !invoice" @click="downloadPdf">
        <ArrowDownTrayIcon class="w-4 h-4" />{{ pdfBusy ? 'Mengunduh…' : 'PDF' }}
      </button>
    </div>
    <p v-if="error" class="p-6 text-sm text-red-600">{{ error.data?.statusMessage || 'Tautan tidak valid atau sudah kedaluwarsa' }}</p>
    <InvoiceOfficialSheet v-if="invoice && invoiceStyle === 'resmi'" :invoice="invoice" />
    <InvoiceSheet v-else-if="invoice" :invoice="invoice" />
  </div>
</template>
