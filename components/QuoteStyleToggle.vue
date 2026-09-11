<script setup>
import { QUOTE_STYLES, quoteStyleLabel } from '~/utils/quoteStyle.js'

defineProps({
  modelValue: { type: String, default: 'ringkas' }
})
const emit = defineEmits(['update:modelValue'])
</script>

<template>
  <div class="inline-flex rounded-panel overflow-hidden border border-ink-600 bg-ink-800 h-10">
    <button
      v-for="s in QUOTE_STYLES"
      :key="s"
      type="button"
      class="px-3 text-sm font-medium transition-colors"
      :class="modelValue === s ? 'bg-white text-ink-900' : 'text-ink-200 hover:text-white'"
      @click="emit('update:modelValue', s)"
    >
      {{ quoteStyleLabel[s] }}
    </button>
  </div>
</template>
