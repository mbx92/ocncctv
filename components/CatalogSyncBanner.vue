<script setup>
import { BuildingStorefrontIcon } from '@heroicons/vue/24/outline'

defineProps({
  variant: { type: String, default: 'default' }
})

const { open, trigger, panel, panelStyle, toggle, close } = useAnchoredPanel()
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

function onToggle() {
  toggle()
  if (open.value && unread.value) markSeen()
}
</script>

<template>
  <div ref="trigger" class="relative shrink-0">
    <button
      v-if="variant === 'network'"
      type="button"
      class="network-icon-button relative"
      aria-label="Katalog supplier"
      :aria-expanded="open"
      @click.stop="onToggle"
    >
      <BuildingStorefrontIcon />
      <span
        v-if="unread"
        class="absolute top-0.5 right-0.5 w-2 h-2 rounded-full bg-teal-500 ring-2 ring-white"
      />
    </button>
    <button
      v-else
      type="button"
      class="btn-secondary relative !px-2.5"
      aria-label="Katalog supplier"
      :aria-expanded="open"
      @click.stop="onToggle"
    >
      <BuildingStorefrontIcon class="w-4 h-4" />
      <span
        v-if="unread"
        class="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-teal-500 ring-2 ring-white"
      />
    </button>

    <Teleport to="body">
      <div
        v-if="open"
        ref="panel"
        class="panel p-0 shadow-lg overflow-hidden overflow-y-auto"
        :style="panelStyle"
        @click.stop
      >
        <div class="px-3 py-2 border-b border-ink-100">
          <div class="text-sm font-semibold">Katalog supplier</div>
          <div class="text-[11px] text-ink-400">Pembaruan harga dari supplier</div>
        </div>
        <div v-if="notice?.lastSyncedAt" class="px-3 py-3 space-y-1.5">
          <p class="text-sm font-medium text-ink-900">Katalog sudah diperbarui</p>
          <p class="text-xs text-ink-600">{{ notice.message || 'Data harga dari supplier sudah di-sync.' }}</p>
          <p class="text-xs text-ink-500">
            {{ formatCatalogSyncTime(notice.lastSyncedAt) }}
            <span v-if="notice.source === 'schedule'"> · otomatis</span>
            <span v-if="counts"> · {{ counts }}</span>
          </p>
          <NuxtLink to="/catalog" class="inline-flex text-xs font-medium text-teal-800 hover:underline pt-1" @click="close">
            Buka katalog
          </NuxtLink>
        </div>
        <p v-else class="px-3 py-6 text-sm text-ink-400 text-center">Belum ada sync katalog.</p>
      </div>
    </Teleport>
  </div>
</template>
