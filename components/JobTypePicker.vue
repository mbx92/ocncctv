<script setup>
import { JOB_TYPES, jobTypeLabel } from '~/utils/jobType.js'

defineProps({
  disabled: { type: Boolean, default: false }
})

const model = defineModel({ type: String, default: 'install' })
</script>

<template>
  <div>
    <label class="label">Tipe pekerjaan</label>
    <div class="inline-flex w-full rounded-panel border border-ink-200 overflow-hidden h-10">
      <button
        v-for="t in JOB_TYPES"
        :key="t"
        type="button"
        class="flex-1 px-3 text-sm font-medium transition-colors disabled:opacity-50"
        :class="model === t ? 'bg-accent-500 text-white' : 'bg-white text-ink-600 hover:bg-ink-50'"
        :disabled="disabled"
        @click="model = t"
      >
        {{ jobTypeLabel[t] }}
      </button>
    </div>
  </div>
</template>
