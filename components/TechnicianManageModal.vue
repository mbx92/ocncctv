<script setup>
import { CheckIcon, TrashIcon } from '@heroicons/vue/24/outline'

defineProps({
  nested: { type: Boolean, default: false }
})
const emit = defineEmits(['close', 'created', 'changed'])

const { data: technicians, refresh } = await useFetch('/api/technicians')
const form = ref({ name: '', notes: '' })
const errorMsg = ref('')
const saving = ref(false)

async function save() {
  errorMsg.value = ''
  saving.value = true
  try {
    const created = await $fetch('/api/technicians', { method: 'POST', body: form.value })
    await refresh()
    form.value = { name: '', notes: '' }
    useToast().success(`Teknisi "${created.name}" ditambahkan.`)
    emit('created', created)
    emit('changed')
  } catch (e) {
    errorMsg.value = e.data?.statusMessage || 'Gagal menambah teknisi'
  } finally {
    saving.value = false
  }
}

async function remove(t) {
  if (!(await useConfirm().confirm(`Hapus teknisi "${t.name}"? Upah dan pengeluaran lama tetap tersimpan.`))) return
  try {
    await $fetch(`/api/technicians/${t.id}`, { method: 'DELETE' })
    await refresh()
    emit('changed')
  } catch (e) {
    useToast().error(e.data?.statusMessage || 'Gagal menghapus')
  }
}
</script>

<template>
  <AppModal title="Teknisi" :nested="nested" @close="emit('close')">
    <div class="space-y-4">
      <form class="space-y-3" @submit.prevent="save">
        <div>
          <label class="label">Nama teknisi baru</label>
          <input v-model="form.name" class="input" required placeholder="Andi" />
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
        <div class="label">Daftar teknisi</div>
        <ul
          v-if="technicians?.length"
          class="border border-ink-200 rounded-panel divide-y divide-ink-100 max-h-56 overflow-y-auto"
        >
          <li v-for="t in technicians" :key="t.id" class="flex items-center gap-2 px-3 py-2">
            <div class="min-w-0 flex-1">
              <div class="font-medium text-sm truncate">{{ t.name }}</div>
              <div v-if="t.notes" class="text-xs text-ink-400 truncate">{{ t.notes }}</div>
            </div>
            <button type="button" class="btn-action-danger" @click="remove(t)">
              <TrashIcon class="w-3.5 h-3.5" />
            </button>
          </li>
        </ul>
        <p v-else class="text-sm text-ink-500 py-3 text-center">Belum ada teknisi. Tambahkan lewat form di atas.</p>
      </div>
    </div>
  </AppModal>
</template>
