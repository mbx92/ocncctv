<script setup>
import { ArrowLeftIcon, PrinterIcon } from '@heroicons/vue/24/outline'
import { buildProjectInvoicePreview } from '~/utils/invoiceItems.js'
import { parseQuoteStyle } from '~/utils/quoteStyle.js'
import { consumableLotItem } from '~/utils/consumableLot.js'

definePageMeta({ layout: 'print' })

const route = useRoute()
const router = useRouter()
const id = route.params.id
const { data: product, error } = await useFetch(`/api/products/${id}`)
const { data: settings } = await useFetch('/api/settings')
const { data: projectSales } = await useFetch(`/api/sales?productId=${id}`)

const invoiceStyle = computed({
  get: () => parseQuoteStyle(route.query.tampilan),
  set(value) {
    const query = { ...route.query }
    if (value === 'resmi') query.tampilan = 'resmi'
    else delete query.tampilan
    router.replace({ query })
  }
})

const materialCost = computed(() =>
  (product.value?.materialUsages || []).reduce((sum, row) => sum + (Number(row.amount) || 0), 0)
)

const invoice = computed(() => {
  return buildProjectInvoicePreview({
    product: product.value,
    settings: settings.value,
    rabLines: product.value?.rab?.lines || [],
    extraLines: product.value?.extraLines || [],
    sale: (projectSales.value || [])[0] || null,
    downPayment: product.value?.downPaymentTotal,
    date: todayStr(),
    consumableLot: consumableLotItem(materialCost.value, settings.value, product.value?.consumableLotSale)
  })
})

useHead({
  title: computed(() =>
    invoice.value?.invoiceNumber && !invoice.value.preview
      ? `Invoice ${invoice.value.invoiceNumber}`
      : `Preview invoice ${product.value?.name || ''}`
  )
})

function printInvoice() {
  if (import.meta.client) window.print()
}
</script>

<template>
  <div class="min-h-screen bg-ink-100 print:bg-white">
    <div class="no-print sticky top-0 z-10 flex flex-col gap-2 px-3 py-2.5 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:px-4 sm:py-3 bg-ink-900 text-ink-100 print:hidden">
      <NuxtLink :to="`/projects/${id}?tab=invoice`" class="inline-flex items-center gap-1 text-sm hover:text-white">
        <ArrowLeftIcon class="w-4 h-4" /> Proyek
      </NuxtLink>
      <div class="flex flex-wrap items-center gap-2">
        <QuoteStyleToggle v-model="invoiceStyle" />
        <button class="btn-secondary !text-ink-800" type="button" @click="printInvoice">
          <PrinterIcon class="w-4 h-4" />Cetak
        </button>
      </div>
    </div>

    <p v-if="error" class="p-6 text-sm text-red-600">{{ error.data?.statusMessage || 'Proyek tidak ditemukan' }}</p>
    <InvoiceOfficialSheet v-else-if="invoice && invoiceStyle === 'resmi'" :invoice="invoice" />
    <InvoiceSheet v-else-if="invoice" :invoice="invoice" />
  </div>
</template>
