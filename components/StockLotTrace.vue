<script setup>
const props = defineProps({
  packagingId: { type: [Number, String], default: null },
  projectId: { type: [Number, String], default: null }
})

const { data: lots } = await useFetch(() =>
  props.packagingId ? `/api/packaging/${props.packagingId}/lots` : `/api/products/${props.projectId}/stock-lots`
)

function returnedQty(lot) {
  return Math.max(Number(lot.remaining) || 0, 0)
}
</script>

<template>
  <div class="space-y-3">
    <p class="text-xs text-ink-500">
      Lot adalah penanda pembelian. Sisa yang kembali ke stok tetap memakai ID lot yang sama.
    </p>
    <div v-if="lots?.length" class="space-y-3">
      <div v-for="lot in lots" :key="lot.id" class="rounded-panel border border-ink-200 p-3 space-y-2">
        <div class="flex items-start justify-between gap-2">
          <div>
            <div class="text-sm font-semibold">{{ lot.code }}<span v-if="!packagingId"> · {{ lot.packagingName }}</span></div>
            <div class="text-xs text-ink-500">
              Proyek pertama: {{ lot.originProjectName || 'Tanpa proyek' }}
              · beli {{ formatNumber(lot.quantityIn) }} {{ lot.unit }}
              <span v-if="returnedQty(lot)"> · kembali ke stok {{ formatNumber(returnedQty(lot)) }} {{ lot.unit }}</span>
            </div>
          </div>
          <span class="font-mono text-xs text-ink-400">{{ formatDate(lot.receivedDate) }}</span>
        </div>
        <ul v-if="lot.moves.length" class="space-y-1 text-xs text-ink-600">
          <li v-for="move in lot.moves" :key="move.id">
            {{ formatDate(move.date) }} · {{ formatNumber(move.quantity) }} {{ lot.unit }}
            ke {{ move.projectName || 'tanpa proyek' }}
            <span v-if="!move.affectsStock" class="text-ink-400">· saat beli</span>
          </li>
        </ul>
        <p v-else class="text-xs text-ink-400">Seluruh pembelian kembali ke stok. ID lot tetap {{ lot.code }}.</p>
      </div>
    </div>
    <p v-else class="text-sm text-ink-500">Belum ada penanda lot.</p>
  </div>
</template>
