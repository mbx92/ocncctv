<script setup>
import { BellIcon } from '@heroicons/vue/24/outline'

defineProps({
  variant: { type: String, default: 'default' }
})

const open = ref(false)
const root = ref(null)
const { items, refreshItems } = useReminders()

function onDocClick(e) {
  if (!open.value) return
  if (root.value && !root.value.contains(e.target)) open.value = false
}

function toggle() {
  open.value = !open.value
  if (open.value) refreshItems().catch(() => [])
}

onMounted(() => {
  refreshItems().catch(() => [])
  document.addEventListener('click', onDocClick)
})

onUnmounted(() => {
  document.removeEventListener('click', onDocClick)
})
</script>

<template>
  <div ref="root" class="relative">
    <button
      v-if="variant === 'network'"
      type="button"
      class="network-icon-button relative"
      aria-label="Pengingat"
      :aria-expanded="open"
      @click.stop="toggle"
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
      @click.stop="toggle"
    >
      <BellIcon class="w-4 h-4" />
      <span
        v-if="items.length"
        class="absolute -top-1 -right-1 min-w-[1.05rem] h-4 px-0.5 rounded-full bg-amber-500 text-white text-[10px] font-semibold leading-4 text-center"
      >
        {{ items.length > 9 ? '9+' : items.length }}
      </span>
    </button>

    <div
      v-if="open"
      class="absolute right-0 top-full mt-2 z-30 w-[min(22rem,calc(100vw-2rem))] panel p-0 shadow-lg overflow-hidden"
    >
      <div class="px-3 py-2 border-b border-ink-100">
        <div class="text-sm font-semibold">Pengingat</div>
        <div class="text-[11px] text-ink-400">Jadwal dan tagihan hari ini</div>
      </div>
      <ul v-if="items.length" class="max-h-72 overflow-y-auto divide-y divide-ink-100">
        <li v-for="item in items" :key="item.id">
          <NuxtLink
            :to="item.url"
            class="block px-3 py-2.5 hover:bg-ink-50"
            @click="open = false"
          >
            <div class="text-sm font-medium text-ink-900">{{ item.title }}</div>
            <div class="text-xs text-ink-500 mt-0.5 break-words">{{ item.body }}</div>
          </NuxtLink>
        </li>
      </ul>
      <p v-else class="px-3 py-6 text-sm text-ink-400 text-center">Tidak ada pengingat hari ini.</p>
    </div>
  </div>
</template>
