<script setup>
import { ClipboardDocumentIcon } from '@heroicons/vue/24/outline'
import { copyText } from '~/composables/copyText.js'

const props = defineProps({
  text: { type: String, default: '' },
  successMessage: { type: String, default: 'Nama barang disalin' }
})

function onCopy() {
  copyText(props.text, props.successMessage)
}
</script>

<template>
  <button
    type="button"
    class="group inline-flex max-w-full items-start gap-1 text-left bg-transparent p-0 cursor-pointer hover:text-accent-700"
    title="Salin nama"
    @click.stop="onCopy"
  >
    <span class="min-w-0 break-words"><slot>{{ text }}</slot></span>
    <ClipboardDocumentIcon
      class="w-3.5 h-3.5 mt-0.5 shrink-0 text-ink-400 opacity-80 group-hover:text-accent-600 md:opacity-0 md:group-hover:opacity-80"
    />
  </button>
</template>
