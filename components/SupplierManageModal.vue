<script setup>
import { CheckIcon, TrashIcon } from '@heroicons/vue/24/outline'

defineProps({
  nested: { type: Boolean, default: false }
})
const emit = defineEmits(['close', 'created', 'changed'])

const { data: suppliers, refresh } = await useFetch('/api/suppliers')
const form = ref({ name: '', notes: '' })
const errorMsg = ref('')
const saving = ref(false)

async function save() {
  errorMsg.value = ''
  saving.value = true
  try {
    const created = await $fetch('/api/suppliers', { method: 'POST', body: form.value })
    await refresh()
    form.value = { name: '', notes: '' }
    useToast().success(`Supplier "${created.name}" ditambahkan.`)
    emit('created', created)
    emit('changed')
  } catch (e) {
    errorMsg.value = e.data?.statusMessage || 'Gagal menambah supplier'
  } finally {
    saving.value = false
  }
}

async function remove(s) {
  if (!(await useConfirm().confirm(`Hapus supplier "${s.name}"? Pembelian dan produk lama tetap tersimpan.`))) return
  try {
    await $fetch(`/api/suppliers/${s.id}`, { method: 'DELETE' })
    await refresh()
    emit('changed')
  } catch (e) {
    useToast().error(e.data?.statusMessage || 'Gagal menghapus')
  }
}
</script>

<template>
  <AppModal title="Supplier" :nested="nested" @close="emit('close')">
    <div class="space-y-4">
      <form class="space-y-3" @submit.prevent="save">
        <div>
          <label class="label">Nama supplier baru</label>
          <input v-model="form.name" class="input" required placeholder="PL Tunas Jaya" />
        </div>
        <div>
          <label class="label">Catatan</label>
          <input v-model="form.notes" class="input" placeholder="opsional" />
        </div>
        <p v-if="errorMsg" class="text-sm text-red-600">{{ errorMsg }}</p>
        <div class="flex justify-end">
          <button type="submit" class="btn-primary" :disabled="saving">
            <CheckIcon class="w-4 h-4" />{{ saving ? 'Menyimpan...' : 'Tambah' }}
          </button>
        </div>
      </form>

      <div>
        <div class="label">Daftar supplier</div>
        <ul
          v-if="suppliers?.length"
          class="border border-ink-200 rounded-panel divide-y divide-ink-100 max-h-56 overflow-y-auto"
        >
          <li v-for="s in suppliers" :key="s.id" class="flex items-center gap-2 px-3 py-2">
            <div class="min-w-0 flex-1">
              <div class="font-medium text-sm truncate">{{ s.name }}</div>
              <div v-if="s.notes" class="text-xs text-ink-400 truncate">{{ s.notes }}</div>
            </div>
            <button type="button" class="btn-action-danger" @click="remove(s)">
              <TrashIcon class="w-3.5 h-3.5" />
            </button>
          </li>
        </ul>
        <p v-else class="text-sm text-ink-500 py-3 text-center">Belum ada supplier. Tambahkan lewat form di atas.</p>
      </div>
    </div>
  </AppModal>
</template>
