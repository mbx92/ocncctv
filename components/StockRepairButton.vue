<script setup>
import { WrenchScrewdriverIcon } from '@heroicons/vue/24/outline'

const props = defineProps({
  kind: { type: String, required: true }
})

const emit = defineEmits(['done'])

const isMaterials = computed(() => props.kind === 'materials')
const endpoint = computed(() => (isMaterials.value ? '/api/materials/stock-repair' : '/api/packaging/stock-repair'))
const title = computed(() => (isMaterials.value ? 'Perbaiki data perlengkapan' : 'Perbaiki stok produk'))

const open = ref(false)
const loading = ref(false)
const applying = ref(false)
const errorMsg = ref('')
const preview = ref(null)

const rows = computed(() => preview.value?.items || [])
const changedRows = computed(() => rows.value.filter((row) => row.changed))

async function loadPreview() {
  errorMsg.value = ''
  loading.value = true
  try {
    preview.value = await $fetch(endpoint.value)
    open.value = true
  } catch (e) {
    useToast().error(e.data?.statusMessage || 'Gagal memeriksa data stok')
  } finally {
    loading.value = false
  }
}

async function applyFix() {
  const ok = await useConfirm().confirm(
    changedRows.value.length
      ? `Perbaiki ${changedRows.value.length} item? Stok yang sudah benar tidak diubah.`
      : 'Tidak ada angka yang perlu diubah. Tetap jalankan perbaikan lot/status?',
    { title: title.value, confirmText: 'Perbaiki', variant: 'primary', danger: false }
  )
  if (!ok) return
  applying.value = true
  errorMsg.value = ''
  try {
    const result = await $fetch(endpoint.value, { method: 'POST' })
    preview.value = { items: result.items, changedCount: result.items.filter((row) => row.changed).length }
    const extra = result.lotsCreated ? ` · ${result.lotsCreated} lot` : ''
    useToast().success(
      result.changed.length || result.lotsCreated
        ? `Perbaikan selesai: ${result.changed.length} stok${extra}.`
        : 'Data stok sudah sesuai.'
    )
    open.value = false
    emit('done')
  } catch (e) {
    errorMsg.value = e.data?.statusMessage || 'Gagal memperbaiki data'
  } finally {
    applying.value = false
  }
}
</script>

<template>
  <div>
    <button type="button" class="btn-secondary" :disabled="loading" @click="loadPreview">
      <WrenchScrewdriverIcon class="w-4 h-4" />
      <span class="hidden sm:inline">{{ loading ? 'Memeriksa…' : 'Perbaiki' }}</span>
    </button>
    <AppModal v-if="open" :title="title" size="lg" @close="open = false">
      <div class="space-y-3">
        <p class="text-xs text-ink-500">
          <template v-if="isMaterials">
            Status stok disamakan dengan qty. Pembelian dan pemakaian hanya ditampilkan, stok tidak dihitung ulang dari RAB.
          </template>
          <template v-else>
            Lot yang belum ada dibuat dari pembelian. Jika stok gudang tidak sama dengan sisa lot, stok disamakan ke sisa lot.
          </template>
        </p>
        <p v-if="errorMsg" class="text-sm text-red-600">{{ errorMsg }}</p>
        <div v-if="rows.length" class="overflow-x-auto max-h-[min(52vh,22rem)]">
          <table class="table-std text-sm">
            <thead>
              <tr>
                <th>Item</th>
                <th class="text-right">Stok</th>
                <th v-if="isMaterials" class="text-right">Beli / pakai</th>
                <th v-else class="text-right">Sisa lot</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in rows" :key="row.id" :class="row.changed ? 'bg-amber-50/70' : ''">
                <td class="font-medium">{{ row.name }}</td>
                <td class="num whitespace-nowrap">
                  {{ formatNumber(row.current) }}
                  <span v-if="row.current !== row.next"> → {{ formatNumber(row.next) }}</span>
                  {{ row.unit }}
                </td>
                <td v-if="isMaterials" class="num text-ink-500 whitespace-nowrap">
                  +{{ formatNumber(row.purchasedIn) }} / −{{ formatNumber(row.used) }}
                  <span v-if="row.unrecorded" class="block text-[11px] text-amber-700">
                    {{ formatNumber(row.unrecorded) }} belum tercatat pemakaian
                  </span>
                </td>
                <td v-else class="num text-ink-500 whitespace-nowrap">
                  {{ formatNumber(row.remaining) }} {{ row.unit }}
                  <span v-if="row.missingLotCount" class="block text-[11px] text-amber-700">
                    {{ row.missingLotCount }} lot pembelian belum ada
                  </span>
                  <span v-else-if="row.needsOpeningLot" class="block text-[11px] text-amber-700">
                    stok awal belum punya lot
                  </span>
                </td>
                <td class="text-xs">
                  <span v-if="row.changed" class="text-amber-700">Perlu diperbaiki</span>
                  <span v-else class="text-ink-400">Sesuai</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <p v-else class="text-sm text-ink-500">Tidak ada data.</p>
        <div class="flex justify-end gap-2 pt-1">
          <button type="button" class="btn-secondary" @click="open = false">Tutup</button>
          <button type="button" class="btn-primary" :disabled="applying" @click="applyFix">
            {{ applying ? 'Memperbaiki…' : 'Perbaiki' }}
          </button>
        </div>
      </div>
    </AppModal>
  </div>
</template>
