<script setup>
import { PrinterIcon, ArrowDownTrayIcon } from '@heroicons/vue/24/outline'

definePageMeta({ layout: 'print' })

const route = useRoute()
const { data: quote, error } = await useFetch(`/api/public/quotes/${route.params.token}`)

useHead({
  title: computed(() => (quote.value ? `Penawaran ${quote.value.quoteNumber}` : 'Penawaran'))
})

const pdfBusy = ref(false)

function printQuote() {
  if (import.meta.client) window.print()
}

async function downloadPdf() {
  if (!quote.value) return
  pdfBusy.value = true
  try {
    const blob = await $fetch(`/api/public/quotes/${route.params.token}/pdf`, { responseType: 'blob' })
    const href = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = href
    a.download = `${quote.value.quoteNumber}.pdf`
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
    <div class="no-print sticky top-0 z-10 flex items-center justify-end gap-2 px-4 py-3 bg-ink-900 text-ink-100 print:hidden">
      <button class="btn-secondary !text-ink-800" type="button" @click="printQuote">
        <PrinterIcon class="w-4 h-4" />Cetak
      </button>
      <button class="btn-primary" type="button" :disabled="pdfBusy || !quote" @click="downloadPdf">
        <ArrowDownTrayIcon class="w-4 h-4" />{{ pdfBusy ? 'Mengunduh…' : 'PDF' }}
      </button>
    </div>
    <p v-if="error" class="p-6 text-sm text-red-600">{{ error.data?.statusMessage || 'Tautan tidak valid atau sudah kedaluwarsa' }}</p>
    <RabQuoteSheet v-if="quote" :quote="quote" />
  </div>
</template>
