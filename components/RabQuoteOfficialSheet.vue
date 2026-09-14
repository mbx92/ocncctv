<script setup>
import { terbilangRupiah } from '~/utils/terbilang.js'
import { jobTypeLabel } from '~/utils/jobType.js'
import { QUOTE_OFFICIAL_DEFAULTS } from '~/utils/quoteOfficial.js'

const props = defineProps({
  quote: { type: Object, required: true }
})

function formatQuoteQty(item) {
  const qty = Number(item?.quantity) || 0
  return Number.isInteger(qty) ? String(qty) : String(qty)
}

function itemUnit(item) {
  return String(item?.unit || '').trim() || (item?.lineType === 'service' ? 'ls' : 'pcs')
}

const jobLabel = computed(() => {
  if (props.quote.jobTypeLabel) return props.quote.jobTypeLabel
  return jobTypeLabel[props.quote.jobType] || null
})

const copy = computed(() => {
  const official = props.quote.official || {}
  return {
    title: official.title || QUOTE_OFFICIAL_DEFAULTS.title,
    greeting: official.greeting || QUOTE_OFFICIAL_DEFAULTS.greeting,
    intro: official.intro || QUOTE_OFFICIAL_DEFAULTS.intro,
    terms: Array.isArray(official.terms) && official.terms.length
      ? official.terms
      : QUOTE_OFFICIAL_DEFAULTS.terms.split('\n').filter(Boolean),
    closing: official.closing || QUOTE_OFFICIAL_DEFAULTS.closing,
    signOff: official.signOff || QUOTE_OFFICIAL_DEFAULTS.signOff,
    signer: official.signer || props.quote.business?.name || 'OCN',
    signHint: official.signHint || QUOTE_OFFICIAL_DEFAULTS.signHint
  }
})
</script>

<template>
  <article class="invoice-sheet mx-auto my-4 sm:my-6 w-full sm:w-[210mm] max-w-full min-w-0 bg-white px-4 py-5 sm:p-10 shadow-sm print:my-0 print:p-10 print:shadow-none print:w-full">
    <header class="border-b-2 border-ink-900 pb-4">
      <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4 print:flex-row print:items-start print:justify-between">
        <div class="flex items-start gap-3 min-w-0">
          <img src="/pwa-192x192.png" alt="" class="w-12 h-12 sm:w-14 sm:h-14 rounded-lg object-cover shrink-0" />
          <div class="min-w-0">
            <h1 class="text-xl font-bold tracking-wide text-ink-900 break-words">{{ quote.business.name }}</h1>
            <p v-if="quote.business.address" class="text-xs text-ink-600 whitespace-pre-line mt-1 break-words">{{ quote.business.address }}</p>
            <p v-if="quote.business.phone" class="text-xs text-ink-600 mt-0.5 break-words">{{ quote.business.phone }}</p>
          </div>
        </div>
        <div class="sm:text-right print:text-right text-xs text-ink-600 space-y-0.5 shrink-0">
          <div><span class="text-ink-500">No.</span> <span class="font-mono font-semibold text-ink-900">{{ quote.quoteNumber }}</span></div>
          <div><span class="text-ink-500">Tanggal</span> {{ formatDate(quote.date) }}</div>
        </div>
      </div>
    </header>

    <div class="text-center py-5">
      <h2 class="text-base sm:text-lg font-bold uppercase tracking-wide sm:tracking-[0.18em] text-ink-900 break-words">{{ copy.title }}</h2>
      <p v-if="jobLabel" class="text-xs text-ink-500 mt-1 break-words">Jenis pekerjaan: {{ jobLabel }}</p>
    </div>

    <section class="text-sm space-y-3">
      <div>
        <div class="text-ink-500">Kepada Yth.</div>
        <div class="font-semibold text-ink-900 break-words">{{ quote.customerName || 'Pelanggan' }}</div>
        <div class="text-ink-500">di tempat</div>
      </div>
      <p class="whitespace-pre-line break-words">{{ copy.greeting }}</p>
      <p class="whitespace-pre-line break-words">{{ copy.intro }}</p>
    </section>

    <div class="sm:hidden print:hidden mt-5 border border-ink-300">
      <div
        v-for="(item, i) in quote.items"
        :key="i"
        class="border-b border-ink-200 px-3 py-3 last:border-b-0"
      >
        <div class="flex gap-2 items-start">
          <span class="font-mono text-ink-500 shrink-0 w-5">{{ i + 1 }}</span>
          <div class="min-w-0 flex-1">
            <div class="break-words">
              {{ item.name }}
              <span v-if="item.lineType === 'service'" class="text-xs text-ink-400"> · Jasa</span>
            </div>
            <div class="mt-1.5 flex items-baseline justify-between gap-3 text-sm">
              <span class="min-w-0 text-ink-500 font-mono break-words">{{ formatQuoteQty(item) }} {{ itemUnit(item) }} × {{ formatIDR(item.unitPrice) }}</span>
              <span class="font-mono shrink-0">{{ formatIDR(item.amount) }}</span>
            </div>
          </div>
        </div>
      </div>
      <div v-if="!quote.items?.length" class="py-6 text-center text-sm text-ink-400">Belum ada item.</div>
      <div class="flex justify-between gap-3 border-t-2 border-ink-900 bg-ink-50 px-3 py-2.5 font-semibold">
        <span>Total</span>
        <span class="font-mono">{{ formatIDR(quote.total) }}</span>
      </div>
    </div>

    <table class="hidden sm:table print:table w-full text-sm border border-ink-300 mt-5">
      <thead>
        <tr class="bg-ink-50 text-left text-[11px] uppercase tracking-wide text-ink-600">
          <th class="py-2 px-2 w-10 border-b border-ink-300 text-center">No</th>
          <th class="py-2 px-2 border-b border-ink-300">Uraian</th>
          <th class="py-2 px-2 border-b border-ink-300 text-right w-16">Qty</th>
          <th class="py-2 px-2 border-b border-ink-300 text-right w-16">Sat.</th>
          <th class="py-2 px-2 border-b border-ink-300 text-right w-28">Harga</th>
          <th class="py-2 px-2 border-b border-ink-300 text-right w-28">Jumlah</th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="(item, i) in quote.items"
          :key="i"
          class="border-t border-ink-200 align-top"
        >
          <td class="py-2 px-2 text-center font-mono text-ink-500">{{ i + 1 }}</td>
          <td class="py-2 px-2 break-words">
            {{ item.name }}
            <span v-if="item.lineType === 'service'" class="text-xs text-ink-400"> · Jasa</span>
          </td>
          <td class="py-2 px-2 text-right font-mono whitespace-nowrap">{{ formatQuoteQty(item) }}</td>
          <td class="py-2 px-2 text-right text-ink-600">{{ itemUnit(item) }}</td>
          <td class="py-2 px-2 text-right font-mono whitespace-nowrap">{{ formatIDR(item.unitPrice) }}</td>
          <td class="py-2 px-2 text-right font-mono whitespace-nowrap">{{ formatIDR(item.amount) }}</td>
        </tr>
        <tr v-if="!quote.items?.length">
          <td colspan="6" class="py-6 text-center text-ink-400">Belum ada item.</td>
        </tr>
        <tr class="border-t-2 border-ink-900 font-semibold bg-ink-50">
          <td colspan="5" class="py-2.5 px-2 text-right">Total</td>
          <td class="py-2.5 px-2 text-right font-mono">{{ formatIDR(quote.total) }}</td>
        </tr>
      </tbody>
    </table>

    <p class="mt-3 text-sm italic text-ink-700 break-words">
      Terbilang: {{ terbilangRupiah(quote.total) }}
    </p>

    <section class="mt-6 text-sm space-y-2">
      <div class="text-xs font-semibold uppercase tracking-wide text-ink-500">Keterangan</div>
      <ul class="list-disc pl-5 space-y-1 text-ink-700">
        <li v-for="(row, i) in copy.terms" :key="i" class="whitespace-pre-wrap break-words">{{ row }}</li>
        <li v-if="quote.notes" class="break-words">{{ quote.notes }}</li>
      </ul>
    </section>

    <p class="mt-6 text-sm whitespace-pre-line break-words">{{ copy.closing }}</p>

    <div class="mt-10 flex justify-end">
      <div class="text-center text-sm w-full max-w-[13rem]">
        <div class="whitespace-pre-line break-words">{{ copy.signOff }}</div>
        <div class="font-semibold break-words">{{ copy.signer }}</div>
        <div class="h-20"></div>
        <div class="border-t border-ink-400 pt-1 text-xs text-ink-500">{{ copy.signHint }}</div>
      </div>
    </div>
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
