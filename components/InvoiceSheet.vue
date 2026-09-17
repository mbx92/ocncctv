<script setup>
defineProps({
  invoice: { type: Object, required: true }
})

function invoiceItems(invoice) {
  if (invoice.items?.length) return invoice.items
  return invoice.item ? [invoice.item] : []
}

function formatInvoiceQty(item) {
  return item.unit ? `${item.quantity} ${item.unit}` : item.quantity
}
</script>

<template>
  <article class="invoice-sheet mx-auto my-4 sm:my-6 w-full sm:w-[210mm] max-w-full min-w-0 bg-white px-4 py-5 sm:p-8 shadow-sm print:my-0 print:p-8 print:shadow-none print:w-full">
    <header class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4 border-b border-ink-200 pb-4 print:flex-row print:items-start print:justify-between">
      <div class="flex items-start gap-3 min-w-0">
        <img src="/pwa-192x192.png" alt="" class="w-11 h-11 sm:w-12 sm:h-12 rounded-xl object-cover shrink-0" />
        <div class="min-w-0">
          <h1 class="text-lg font-bold tracking-wide break-words">{{ invoice.business.name }}</h1>
          <p v-if="invoice.business.address" class="text-sm text-ink-600 whitespace-pre-line break-words">{{ invoice.business.address }}</p>
          <p v-if="invoice.business.phone" class="text-sm text-ink-600 break-words">{{ invoice.business.phone }}</p>
        </div>
      </div>
      <div class="sm:text-right print:text-right shrink-0">
        <div class="text-xs font-semibold uppercase tracking-wide text-ink-500">Invoice</div>
        <div class="font-mono text-lg font-semibold break-words">{{ invoice.invoiceNumber }}</div>
        <div class="text-sm text-ink-600 mt-1">{{ formatDate(invoice.date) }}</div>
      </div>
    </header>

    <section class="grid grid-cols-1 sm:grid-cols-2 print:grid-cols-2 gap-4 py-4 text-sm">
      <div class="min-w-0">
        <div class="text-xs font-semibold uppercase tracking-wide text-ink-500">Kepada</div>
        <div class="font-medium mt-1 break-words">{{ invoice.customerName }}</div>
      </div>
      <div class="min-w-0 sm:text-right print:text-right">
        <div class="text-xs font-semibold uppercase tracking-wide text-ink-500">Pembayaran</div>
        <div class="mt-1 break-words">
          {{ invoice.paymentStatusLabel }}
          <span v-if="invoice.paymentMethodLabel"> · {{ invoice.paymentMethodLabel }}</span>
        </div>
        <div v-if="invoice.paidAt" class="text-xs text-ink-500 mt-0.5">{{ formatDate(invoice.paidAt) }}</div>
      </div>
    </section>

    <div class="sm:hidden print:hidden border-t border-ink-200">
      <div v-for="(item, i) in invoiceItems(invoice)" :key="i" class="border-b border-ink-100 py-3">
        <div class="font-medium break-words">
          {{ item.name }}
          <span v-if="item.lineType === 'service'" class="text-xs font-normal text-ink-400"> · Jasa</span>
        </div>
        <div class="mt-1.5 flex items-baseline justify-between gap-3 text-sm">
          <span class="min-w-0 text-ink-500 font-mono break-words">{{ formatInvoiceQty(item) }} × {{ formatIDR(item.unitPrice) }}</span>
          <span class="font-mono font-medium shrink-0">{{ formatIDR(item.amount) }}</span>
        </div>
      </div>
    </div>

    <table class="hidden sm:table print:table w-full text-sm border-t border-ink-200">
      <thead>
        <tr class="text-left text-xs uppercase tracking-wide text-ink-500">
          <th class="py-2 pr-2">Item</th>
          <th class="py-2 px-2 text-right">Qty</th>
          <th class="py-2 px-2 text-right">Harga</th>
          <th class="py-2 pl-2 text-right">Jumlah</th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="(item, i) in invoiceItems(invoice)"
          :key="i"
          class="border-t border-ink-100"
        >
          <td class="py-3 pr-2 break-words">
            {{ item.name }}
            <span v-if="item.lineType === 'service'" class="text-xs text-ink-400"> · Jasa</span>
          </td>
          <td class="py-3 px-2 text-right font-mono whitespace-nowrap">
            {{ formatInvoiceQty(item) }}
          </td>
          <td class="py-3 px-2 text-right font-mono whitespace-nowrap">{{ formatIDR(item.unitPrice) }}</td>
          <td class="py-3 pl-2 text-right font-mono whitespace-nowrap">{{ formatIDR(item.amount) }}</td>
        </tr>
      </tbody>
    </table>

    <div class="flex justify-end pt-4">
      <dl class="w-full sm:w-64 text-sm space-y-1">
        <div class="flex justify-between gap-4">
          <dt class="text-ink-500">Subtotal</dt>
          <dd class="font-mono">{{ formatIDR(invoice.subtotal) }}</dd>
        </div>
        <div v-if="invoice.discount" class="flex justify-between gap-4">
          <dt class="text-ink-500">{{ invoice.discountLabel || 'Diskon' }}</dt>
          <dd class="font-mono">− {{ formatIDR(invoice.discount) }}</dd>
        </div>
        <div v-if="invoice.downPayment" class="flex justify-between gap-4">
          <dt class="text-ink-500">{{ invoice.downPaymentLabel || 'Uang muka (DP)' }}</dt>
          <dd class="font-mono">− {{ formatIDR(invoice.downPayment) }}</dd>
        </div>
        <div class="flex justify-between gap-4 border-t border-ink-200 pt-2 font-semibold">
          <dt>{{ invoice.paymentStatus === 'unpaid' && invoice.downPayment ? 'Sisa tagihan' : 'Total' }}</dt>
          <dd class="font-mono text-base">{{ formatIDR(invoice.total) }}</dd>
        </div>
      </dl>
    </div>

    <p v-if="invoice.notes" class="mt-6 text-xs text-ink-500 break-words">Catatan: {{ invoice.notes }}</p>
    <p class="mt-8 text-sm text-ink-600 whitespace-pre-line break-words">{{ invoice.business.footer }}</p>
  </article>
</template>

<style scoped>
.invoice-sheet {
  overflow-wrap: break-word;
  word-break: normal;
}
@media print {
  .invoice-sheet {
    margin: 0;
    box-shadow: none;
    width: auto;
    max-width: none;
  }
}
</style>
