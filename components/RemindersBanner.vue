<script setup>
import { BellIcon } from '@heroicons/vue/24/outline'

defineProps({
  variant: { type: String, default: 'default' }
})

const { open, trigger, panel, panelStyle, toggle, close } = useAnchoredPanel()
const { items, refreshItems } = useReminders()

function onToggle() {
  toggle()
  if (open.value) refreshItems().catch(() => [])
}

onMounted(() => {
  refreshItems().catch(() => [])
})
</script>

<template>
  <div ref="trigger" class="relative shrink-0">
    <button
      v-if="variant === 'network'"
      type="button"
      class="network-icon-button relative"
      aria-label="Pengingat"
      :aria-expanded="open"
      @click.stop="onToggle"
    >
      <BellIcon />
      <span
        v-if="items.length"
        class="absolute top-0.5 right-0.5 min-w-[1rem] h-4 px-0.5 rounded-full bg-amber-500 text-white text-[10px] font-semibold leading-4 text-center"
      >
        {{ items.length > 9 ? '9+' : items.length }}
      </span>
    </button>
    <button
      v-else
      type="button"
      class="btn-secondary relative !px-2.5"
      aria-label="Pengingat"
      :aria-expanded="open"
      @click.stop="onToggle"
    >
      <BellIcon class="w-4 h-4" />
      <span
        v-if="items.length"
        class="absolute -top-1 -right-1 min-w-[1.05rem] h-4 px-0.5 rounded-full bg-amber-500 text-white text-[10px] font-semibold leading-4 text-center"
      >
        {{ items.length > 9 ? '9+' : items.length }}
      </span>
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
          <div class="text-sm font-semibold">Pengingat</div>
          <div class="text-[11px] text-ink-400">Jadwal dan tagihan hari ini</div>
        </div>
        <ul v-if="items.length" class="divide-y divide-ink-100">
          <li v-for="item in items" :key="item.id">
            <NuxtLink
              :to="item.url"
              class="block px-3 py-2.5 hover:bg-ink-50"
              @click="close"
            >
              <div class="text-sm font-medium text-ink-900">{{ item.title }}</div>
              <div class="text-xs text-ink-500 mt-0.5 break-words">{{ item.body }}</div>
            </NuxtLink>
          </li>
        </ul>
        <p v-else class="px-3 py-6 text-sm text-ink-400 text-center">Tidak ada pengingat hari ini.</p>
      </div>
    </Teleport>
  </div>
</template>
