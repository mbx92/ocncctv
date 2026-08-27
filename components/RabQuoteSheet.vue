<script setup>
defineProps({
  quote: { type: Object, required: true }
})

function formatQuoteQty(item) {
  const qty = Number(item?.quantity) || 0
  const n = Number.isInteger(qty) ? String(qty) : String(qty)
  const unit = String(item?.unit || '').trim()
  return unit ? `${n} ${unit}` : n
}
</script>

<template>
  <article class="invoice-sheet mx-auto my-6 w-[210mm] max-w-full bg-white p-8 shadow-sm print:my-0 print:shadow-none print:w-full">
    <header class="flex items-start justify-between gap-4 border-b border-ink-200 pb-4">
      <div class="flex items-start gap-3 min-w-0">
        <img src="/pwa-192x192.png" alt="" class="w-12 h-12 rounded-xl object-cover shrink-0" />
        <div class="min-w-0">
          <h1 class="text-lg font-bold tracking-wide">{{ quote.business.name }}</h1>
          <p v-if="quote.business.address" class="text-sm text-ink-600 whitespace-pre-line">{{ quote.business.address }}</p>
          <p v-if="quote.business.phone" class="text-sm text-ink-600">{{ quote.business.phone }}</p>
        </div>
      </div>
      <div class="text-right shrink-0">
        <div class="text-xs font-semibold uppercase tracking-wide text-ink-500">Penawaran</div>
        <div class="font-mono text-lg font-semibold">{{ quote.quoteNumber }}</div>
        <div class="text-sm text-ink-600 mt-1">{{ formatDate(quote.date) }}</div>
      </div>
    </header>

    <section class="grid grid-cols-2 gap-4 py-4 text-sm">
      <div>
        <div class="text-xs font-semibold uppercase tracking-wide text-ink-500">Kepada</div>
        <div class="font-medium mt-1">{{ quote.customerName }}</div>
      </div>
      <div class="text-right">
        <div class="text-xs font-semibold uppercase tracking-wide text-ink-500">Pekerjaan</div>
        <div class="mt-1 font-medium">{{ quote.title }}</div>
      </div>
    </section>

    <table class="w-full text-sm border-t border-ink-200">
      <thead>
        <tr class="text-left text-xs uppercase tracking-wide text-ink-500">
          <th class="py-2 pr-2">Item</th>
          <th class="py-2 px-2 text-right">Qty</th>
          <th class="py-2 px-2 text-right">Harga</th>
          <th class="py-2 pl-2 text-right">Jumlah</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="(item, i) in quote.items" :key="i" class="border-t border-ink-100">
          <td class="py-3 pr-2">
            {{ item.name }}
            <span v-if="item.code" class="text-xs text-ink-400"> · {{ item.code }}</span>
            <span v-if="item.lineType === 'service'" class="text-xs text-ink-400"> · Jasa</span>
          </td>
          <td class="py-3 px-2 text-right font-mono whitespace-nowrap">{{ formatQuoteQty(item) }}</td>
          <td class="py-3 px-2 text-right font-mono whitespace-nowrap">{{ formatIDR(item.unitPrice) }}</td>
          <td class="py-3 pl-2 text-right font-mono whitespace-nowrap">{{ formatIDR(item.amount) }}</td>
        </tr>
        <tr v-if="!quote.items?.length">
          <td colspan="4" class="py-6 text-center text-ink-400">Belum ada item.</td>
        </tr>
      </tbody>
    </table>

    <div class="flex justify-end pt-4">
      <dl class="w-64 text-sm space-y-1">
        <div class="flex justify-between gap-4 border-t border-ink-200 pt-2 font-semibold">
          <dt>Total</dt>
          <dd class="font-mono text-base">{{ formatIDR(quote.total) }}</dd>
        </div>
      </dl>
    </div>

    <p class="mt-6 text-xs text-ink-400">Dokumen ini adalah penawaran harga, bukan invoice.</p>
    <p v-if="quote.notes" class="mt-3 text-xs text-ink-500">Catatan: {{ quote.notes }}</p>
    <p class="mt-8 text-sm text-ink-600 whitespace-pre-line">{{ quote.business.footer }}</p>
  </article>
</template>

<style scoped>
@media print {
  .invoice-sheet {
    margin: 0;
    box-shadow: none;
    width: auto;
    max-width: none;
  }
}
</style>
