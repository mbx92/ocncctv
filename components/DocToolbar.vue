<script setup>
defineProps({
  title: { type: String, default: 'OCN' }
})
</script>

<template>
  <header class="no-print sticky top-0 z-20 bg-ink-900 text-ink-100 print:hidden">
    <div class="pt-safe flex flex-col sm:flex-row sm:items-center sm:justify-between">
      <div class="flex items-center gap-2 px-3 h-11 min-h-11 sm:h-auto sm:min-h-0 sm:px-4 sm:py-3">
        <slot name="nav">
          <img src="/logo-mark.png" alt="" class="w-6 h-6 object-contain shrink-0" />
          <span class="font-bold tracking-wide truncate">{{ title }}</span>
        </slot>
      </div>
      <div class="flex flex-wrap items-center gap-2 px-3 py-2 border-t border-ink-700 sm:border-0 sm:px-4 sm:py-3">
        <slot />
      </div>
    </div>
  </header>
</template>
