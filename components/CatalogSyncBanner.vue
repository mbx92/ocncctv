<script setup>
import { BuildingStorefrontIcon, XMarkIcon } from '@heroicons/vue/24/outline'

const { notice, unread, markSeen } = useCatalogNotice()

const counts = computed(() => {
  const row = notice.value
  if (!row) return ''
  const parts = []
  if (row.created) parts.push(`${row.created} baru`)
  if (row.updated) parts.push(`${row.updated} diperbarui`)
  if (row.removed) parts.push(`${row.removed} dihapus`)
  return parts.join(' · ')
})

function dismiss() {
  markSeen()
}
</script>

<template>
  <div
    v-if="unread && notice?.lastSyncedAt"
    class="panel catalog-sync-banner flex items-start gap-3 p-3 sm:p-4 border border-teal-200 bg-teal-50"
    role="status"
  >
    <BuildingStorefrontIcon class="w-5 h-5 mt-0.5 shrink-0 text-teal-700" />
    <div class="min-w-0 flex-1">
      <p class="text-sm font-semibold text-ink-900">Katalog supplier sudah diperbarui</p>
      <p class="text-xs text-ink-600 mt-0.5">
        {{ notice.message || 'Data harga dari supplier sudah di-sync.' }}
      </p>
      <p class="text-xs text-ink-500 mt-1">
        {{ formatCatalogSyncTime(notice.lastSyncedAt) }}
        <span v-if="notice.source === 'schedule'"> · otomatis</span>
        <span v-if="counts"> · {{ counts }}</span>
      </p>
      <NuxtLink to="/catalog" class="inline-flex text-xs font-medium text-teal-800 hover:underline mt-2">
        Buka katalog
      </NuxtLink>
    </div>
    <button
      type="button"
      class="p-1 rounded text-ink-400 hover:text-ink-700 hover:bg-white/70"
      aria-label="Tutup pemberitahuan"
      @click="dismiss"
    >
      <XMarkIcon class="w-4 h-4" />
    </button>
  </div>
</template>
