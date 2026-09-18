<script setup>
import { InformationCircleIcon } from '@heroicons/vue/24/outline'

defineProps({
  label: { type: String, default: 'Keterangan' },
  align: { type: String, default: 'start' }
})

const root = ref(null)
const pinned = ref(false)

function toggle(e) {
  e.stopPropagation()
  pinned.value = !pinned.value
}

function onDocPointer(e) {
  if (root.value && !root.value.contains(e.target)) pinned.value = false
}

onMounted(() => document.addEventListener('pointerdown', onDocPointer))
onUnmounted(() => document.removeEventListener('pointerdown', onDocPointer))
</script>

<template>
  <span ref="root" class="relative inline-flex items-center group align-middle">
    <button
      type="button"
      class="inline-flex text-ink-400 hover:text-ink-600 focus:outline-none focus-visible:text-ink-700"
      :aria-label="label"
      :aria-expanded="pinned"
      @click.stop="toggle"
    >
      <InformationCircleIcon class="w-4 h-4" />
    </button>
    <span
      role="tooltip"
      class="absolute top-full z-40 pt-1 w-[min(22rem,calc(100vw-2.5rem))] transition-opacity"
      :class="[
        align === 'end' ? 'right-0' : 'left-0',
        pinned ? 'visible opacity-100' : 'invisible opacity-0 group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100'
      ]"
    >
      <span class="block rounded-panel border border-ink-200 bg-white px-3 py-2 text-xs font-normal normal-case tracking-normal text-ink-600 text-left leading-relaxed shadow-lg space-y-1.5">
        <slot />
      </span>
    </span>
  </span>
</template>
