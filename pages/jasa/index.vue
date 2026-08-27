<script setup>
import { PlusIcon, PencilSquareIcon, TrashIcon, CheckIcon, XMarkIcon, MagnifyingGlassIcon } from '@heroicons/vue/24/outline'
import { SERVICE_UNITS } from '~/utils/rab.js'

const { data: items, refresh } = await useFetch('/api/services')
const isAdmin = computed(() => useState('authUser').value?.role === 'admin')

const search = ref('')
const filteredItems = computed(() => {
  const q = search.value.trim().toLowerCase()
  if (!q) return items.value || []
  return (items.value || []).filter((s) => s.name.toLowerCase().includes(q))
})
const { page, pageSize, paged, total, totalPages, rangeStart, rangeEnd, reset } = usePagination(
  filteredItems,
  10
)
watch(search, reset)

const showForm = ref(false)
const editing = ref(null)
const form = ref({})
const errorMsg = ref('')

function openAdd() {
  editing.value = null
  form.value = { name: '', unit: 'titik', salePrice: 0, notes: '' }
  errorMsg.value = ''
  showForm.value = true
}
function openEdit(s) {
  editing.value = s
  form.value = { name: s.name, unit: s.unit, salePrice: s.salePrice, notes: s.notes || '' }
  errorMsg.value = ''
  showForm.value = true
}
async function save() {
  errorMsg.value = ''
  try {
    if (editing.value) {
      await $fetch(`/api/services/${editing.value.id}`, { method: 'PUT', body: form.value })
      useToast().success('Jasa diperbarui.')
    } else {
      await $fetch('/api/services', { method: 'POST', body: form.value })
      useToast().success('Jasa tersimpan.')
    }
    showForm.value = false
    editing.value = null
    await refresh()
  } catch (e) {
    errorMsg.value = e.data?.statusMessage || 'Gagal menyimpan'
  }
}
async function remove(s) {
  if (!(await useConfirm().confirm(`Hapus jasa "${s.name}"? RAB yang sudah memakai jasa ini tetap menyimpan namanya.`))) {
    return
  }
  try {
    await $fetch(`/api/services/${s.id}`, { method: 'DELETE' })
    await refresh()
  } catch (e) {
    useToast().error(e.data?.statusMessage || 'Gagal menghapus')
  }
}
</script>

<template>
  <div class="space-y-4">
    <div class="flex items-center justify-between gap-2">
      <div>
        <h1 class="text-xl font-bold">Jasa</h1>
        <p class="text-sm text-ink-500">
          Master jasa untuk RAB. Tidak ada stok. Harga jual default bisa diubah per penawaran.
        </p>
      </div>
      <button v-if="isAdmin" class="btn-primary" @click="openAdd">
        <PlusIcon class="w-4 h-4" /><span class="hidden sm:inline">Tambah Jasa</span><span class="sm:hidden">Tambah</span>
      </button>
    </div>

    <div class="relative w-full md:max-w-xs">
      <MagnifyingGlassIcon class="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-ink-400 pointer-events-none" />
      <input
        v-model="search"
        class="input pl-9 w-full"
        type="search"
        enterkeyhint="search"
        autocomplete="off"
        placeholder="Cari nama jasa…"
      />
    </div>

    <div class="md:hidden space-y-2">
      <div v-for="s in paged" :key="s.id" class="panel p-3 space-y-1">
        <div class="font-medium break-words">{{ s.name }}</div>
        <div class="text-sm font-mono">{{ formatIDR(s.salePrice) }}/{{ s.unit }}</div>
        <div v-if="s.notes" class="text-xs text-ink-400">{{ s.notes }}</div>
        <div v-if="isAdmin" class="btn-actions pt-1">
          <button class="btn-action" @click="openEdit(s)"><PencilSquareIcon class="w-3.5 h-3.5" />Edit</button>
          <button class="btn-action-danger" @click="remove(s)"><TrashIcon class="w-3.5 h-3.5" />Hapus</button>
        </div>
      </div>
      <p v-if="!total" class="panel p-6 text-center text-sm text-ink-500">
        {{ search ? 'Tidak ada jasa yang cocok.' : 'Belum ada jasa.' }}
      </p>
      <div v-else class="panel">
        <AppPagination
          v-model:page="page"
          v-model:pageSize="pageSize"
          :total-pages="totalPages"
          :total="total"
          :range-start="rangeStart"
          :range-end="rangeEnd"
        />
      </div>
    </div>

    <div class="panel hidden md:block">
      <div class="overflow-x-auto">
        <table class="table-std">
          <thead>
            <tr>
              <th>Nama</th>
              <th>Unit</th>
              <th class="text-right">Harga jual</th>
              <th>Catatan</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="s in paged" :key="s.id">
              <td class="font-medium">{{ s.name }}</td>
              <td class="text-ink-500">{{ s.unit }}</td>
              <td class="num">{{ formatIDR(s.salePrice) }}</td>
              <td class="text-ink-500">{{ s.notes || '—' }}</td>
              <td class="whitespace-nowrap text-right">
                <div v-if="isAdmin" class="btn-actions justify-end">
                  <button class="btn-action" @click="openEdit(s)"><PencilSquareIcon class="w-3.5 h-3.5" />Edit</button>
                  <button class="btn-action-danger" @click="remove(s)"><TrashIcon class="w-3.5 h-3.5" />Hapus</button>
                </div>
                <span v-else class="text-ink-300 text-xs">—</span>
              </td>
            </tr>
            <tr v-if="!total">
              <td colspan="5" class="text-center text-ink-500 py-6">
                {{ search ? 'Tidak ada jasa yang cocok.' : 'Belum ada jasa.' }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <AppPagination
        v-if="total"
        v-model:page="page"
        v-model:pageSize="pageSize"
        :total-pages="totalPages"
        :total="total"
        :range-start="rangeStart"
        :range-end="rangeEnd"
      />
    </div>

    <AppModal v-if="showForm" :title="editing ? 'Edit Jasa' : 'Tambah Jasa'" @close="showForm = false">
      <form class="space-y-3" @submit.prevent="save">
        <div>
          <label class="label">Nama</label>
          <input v-model="form.name" class="input" required placeholder="mis. pasang kamera, tarik kabel" />
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="label">Unit</label>
            <select v-model="form.unit" class="input">
              <option v-for="u in SERVICE_UNITS" :key="u" :value="u">{{ u }}</option>
            </select>
          </div>
          <div>
            <label class="label">Harga jual default</label>
            <IdrInput v-model="form.salePrice" />
          </div>
        </div>
        <div>
          <label class="label">Catatan</label>
          <input v-model="form.notes" class="input" placeholder="opsional" />
        </div>
        <p class="text-xs text-ink-500">Tidak ada stok. Mengubah harga di sini tidak mengubah RAB yang sudah tersimpan.</p>
        <p v-if="errorMsg" class="text-sm text-red-600">{{ errorMsg }}</p>
        <div class="flex justify-end gap-2 pt-2">
          <button type="button" class="btn-secondary" @click="showForm = false">
            <XMarkIcon class="w-4 h-4" />Batal
          </button>
          <button type="submit" class="btn-primary"><CheckIcon class="w-4 h-4" />Simpan</button>
        </div>
      </form>
    </AppModal>
  </div>
</template>
