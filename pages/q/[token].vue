<script setup>
import { PrinterIcon, ArrowDownTrayIcon } from '@heroicons/vue/24/outline'
import { parseQuoteStyle } from '~/utils/quoteStyle.js'

definePageMeta({ layout: 'print' })

const route = useRoute()
const router = useRouter()
const { data: quote, error } = await useFetch(`/api/public/quotes/${route.params.token}`)

const quoteStyle = computed({
  get: () => parseQuoteStyle(route.query.tampilan),
  set(value) {
    const query = { ...route.query }
    if (value === 'resmi') query.tampilan = 'resmi'
    else delete query.tampilan
    router.replace({ query })
  }
})

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
    const blob = await $fetch(
      `/api/public/quotes/${route.params.token}/pdf${quoteStyle.value === 'resmi' ? '?tampilan=resmi' : ''}`,
      { responseType: 'blob' }
    )
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
    <DocToolbar title="Penawaran">
      <QuoteStyleToggle v-model="quoteStyle" />
      <button class="btn-secondary !text-ink-800" type="button" @click="printQuote">
        <PrinterIcon class="w-4 h-4" />Cetak
      </button>
      <button class="btn-primary" type="button" :disabled="pdfBusy || !quote" @click="downloadPdf">
        <ArrowDownTrayIcon class="w-4 h-4" />{{ pdfBusy ? 'Mengunduh…' : 'PDF' }}
      </button>
    </DocToolbar>
    <p v-if="error" class="p-6 text-sm text-red-600">{{ error.data?.statusMessage || 'Tautan tidak valid atau sudah kedaluwarsa' }}</p>
    <RabQuoteOfficialSheet v-if="quote && quoteStyle === 'resmi'" :quote="quote" />
    <RabQuoteSheet v-else-if="quote" :quote="quote" />
  </div>
</template>
