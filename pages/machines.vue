<script setup>
import { PlusIcon, PencilSquareIcon, TrashIcon, CheckIcon, XMarkIcon, MagnifyingGlassIcon, PhotoIcon } from '@heroicons/vue/24/outline'

const { data: machines, refresh } = await useFetch('/api/machines')
const isAdmin = computed(() => useState('authUser').value?.role === 'admin')

const search = ref('')
const filteredMachines = computed(() => {
  const q = search.value.trim().toLowerCase()
  if (!q) return machines.value || []
  return (machines.value || []).filter(
    (m) => m.name.toLowerCase().includes(q) || (m.notes || '').toLowerCase().includes(q)
  )
})
const { page, pageSize, paged, total, totalPages, rangeStart, rangeEnd, reset } = usePagination(
  filteredMachines,
  10
)
watch(search, reset)

function machineQty(m) {
  const n = Math.round(Number(m?.quantity) || 0)
  return n > 0 ? n : 1
}

function machineTotal(m) {
  return Math.round((Number(m?.purchasePrice) || 0) * machineQty(m))
}

const ownedTotal = computed(() =>
  (machines.value || []).filter((m) => m.acquisition !== 'purchased').reduce((a, m) => a + machineTotal(m), 0)
)
const purchasedTotal = computed(() =>
  (machines.value || []).filter((m) => m.acquisition === 'purchased').reduce((a, m) => a + machineTotal(m), 0)
)

const showForm = ref(false)
const editing = ref(null)
const form = ref({})
const errorMsg = ref('')

const formTotal = computed(() =>
  Math.round((Number(form.value.purchasePrice) || 0) * Math.max(Math.round(Number(form.value.quantity) || 0), 1))
)

function openAdd() {
  editing.value = null
  form.value = {
    name: '',
    purchasePrice: 0,
    quantity: 1,
    purchaseDate: '',
    depreciationMonths: 36,
    notes: '',
    acquisition: 'owned'
  }
  errorMsg.value = ''
  showForm.value = true
}
function openEdit(m) {
  editing.value = m
  form.value = {
    name: m.name,
    purchasePrice: m.purchasePrice,
    quantity: machineQty(m),
    purchaseDate: m.purchaseDate || '',
    depreciationMonths: m.depreciationMonths || 36,
    notes: m.notes || '',
    acquisition: m.acquisition === 'purchased' ? 'purchased' : 'owned'
  }
  errorMsg.value = ''
  showForm.value = true
}
async function save() {
  errorMsg.value = ''
  try {
    const body = { ...form.value }
    if (editing.value) {
      await $fetch(`/api/machines/${editing.value.id}`, { method: 'PUT', body })
      useToast().success('Peralatan diperbarui.')
    } else {
      await $fetch('/api/machines', { method: 'POST', body })
      useToast().success('Peralatan tersimpan.')
    }
    showForm.value = false
    editing.value = null
    await refresh()
  } catch (e) {
    errorMsg.value = e.data?.statusMessage || 'Gagal menyimpan'
  }
}
async function remove(m) {
  if (!(await useConfirm().confirm(`Hapus peralatan "${m.name}"?`))) return
  try {
    await $fetch(`/api/machines/${m.id}`, { method: 'DELETE' })
    await refresh()
  } catch (e) {
    useToast().error(e.data?.statusMessage || 'Gagal menghapus')
  }
}

function acquisitionLabel(m) {
  return m.acquisition === 'purchased' ? 'Beli baru' : 'Sudah dimiliki'
}
</script>

<template>
  <div class="space-y-4">
    <div class="flex items-center justify-between gap-2">
      <div>
        <h1 class="text-xl font-bold">Peralatan</h1>
        <p class="text-xs text-ink-500">
          Alat usaha untuk pemasangan CCTV. Yang sudah ada masuk aset/modal; beli baru tercatat pengeluaran.
        </p>
      </div>
      <button v-if="isAdmin" class="btn-primary" @click="openAdd">
        <PlusIcon class="w-4 h-4" /><span class="hidden sm:inline">Tambah Peralatan</span><span class="sm:hidden">Tambah</span>
      </button>
    </div>

    <div class="grid grid-cols-2 gap-2 sm:gap-3">
      <div class="panel p-3 sm:p-4">
        <div class="text-xs font-semibold uppercase tracking-wide text-ink-500">Aset (sudah dimiliki)</div>
        <div class="mt-1 font-mono text-lg sm:text-xl font-semibold">{{ formatIDR(ownedTotal) }}</div>
        <p class="text-xs text-ink-400 mt-1">Tidak potong kas. Tampil di Modal.</p>
      </div>
      <div class="panel p-3 sm:p-4">
        <div class="text-xs font-semibold uppercase tracking-wide text-ink-500">Beli baru</div>
        <div class="mt-1 font-mono text-lg sm:text-xl font-semibold text-red-600">{{ formatIDR(purchasedTotal) }}</div>
        <p class="text-xs text-ink-400 mt-1">Pengeluaran, potong estimasi kas.</p>
      </div>
    </div>

    <div class="relative w-full md:max-w-xs">
      <MagnifyingGlassIcon class="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-ink-400 pointer-events-none" />
      <input
        v-model="search"
        class="input pl-9 w-full"
        type="search"
        enterkeyhint="search"
        autocomplete="off"
        placeholder="Cari nama alat…"
      />
    </div>

    <div class="md:hidden space-y-2">
      <div v-for="m in paged" :key="m.id" class="panel p-3 space-y-3">
        <div class="flex gap-3">
          <div class="w-14 h-14 rounded border border-ink-200 bg-ink-50 overflow-hidden shrink-0 flex items-center justify-center">
            <img v-if="m.imageKey" :src="`/api/machines/${m.id}/image`" alt="" class="w-full h-full object-cover" />
            <PhotoIcon v-else class="w-5 h-5 text-ink-300" />
          </div>
          <div class="min-w-0 flex-1">
            <div class="font-medium break-words leading-snug">{{ m.name }}</div>
            <span
              class="badge mt-1"
              :class="m.acquisition === 'purchased' ? 'bg-amber-100 text-amber-800' : 'bg-teal-500/10 text-teal-700'"
            >
              {{ acquisitionLabel(m) }}
            </span>
            <p v-if="m.notes" class="text-xs text-ink-400 mt-0.5 line-clamp-2">{{ m.notes }}</p>
          </div>
        </div>
        <dl class="grid grid-cols-2 gap-2 text-sm">
          <div class="rounded-panel bg-ink-50 px-2.5 py-2">
            <dt class="text-[10px] uppercase tracking-wide text-ink-500">Qty</dt>
            <dd class="font-mono font-medium mt-0.5">{{ machineQty(m) }}</dd>
          </div>
          <div class="rounded-panel bg-ink-50 px-2.5 py-2">
            <dt class="text-[10px] uppercase tracking-wide text-ink-500">Harga satuan</dt>
            <dd class="font-mono font-medium mt-0.5">{{ formatIDR(m.purchasePrice) }}</dd>
          </div>
          <div class="rounded-panel bg-ink-50 px-2.5 py-2 col-span-2">
            <dt class="text-[10px] uppercase tracking-wide text-ink-500">Nilai tercatat</dt>
            <dd class="font-mono font-medium mt-0.5">{{ formatIDR(machineTotal(m)) }}</dd>
          </div>
          <div class="rounded-panel bg-ink-50 px-2.5 py-2 col-span-2">
            <dt class="text-[10px] uppercase tracking-wide text-ink-500">Tanggal</dt>
            <dd class="font-mono font-medium mt-0.5">{{ m.purchaseDate ? formatDate(m.purchaseDate) : '—' }}</dd>
          </div>
        </dl>
        <div v-if="isAdmin" class="btn-actions border-t border-ink-100 pt-2">
          <button class="btn-action" @click="openEdit(m)">
            <PencilSquareIcon class="w-3.5 h-3.5" />Edit
          </button>
          <button class="btn-action-danger" @click="remove(m)">
            <TrashIcon class="w-3.5 h-3.5" />Hapus
          </button>
        </div>
      </div>
      <p v-if="!total" class="panel p-6 text-center text-sm text-ink-500">
        {{ search ? 'Tidak ada peralatan yang cocok.' : 'Belum ada peralatan.' }}
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
              <th class="w-14"></th>
              <th>Nama</th>
              <th>Status</th>
              <th class="text-right">Qty</th>
              <th class="text-right">Harga satuan</th>
              <th class="text-right">Nilai</th>
              <th>Tanggal</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="m in paged" :key="m.id">
              <td>
                <div class="w-10 h-10 rounded border border-ink-200 bg-ink-50 overflow-hidden flex items-center justify-center">
                  <img v-if="m.imageKey" :src="`/api/machines/${m.id}/image`" alt="" class="w-full h-full object-cover" />
                  <PhotoIcon v-else class="w-4 h-4 text-ink-300" />
                </div>
              </td>
              <td class="font-medium">
                <div>{{ m.name }}</div>
                <div v-if="m.notes" class="text-xs text-ink-400 font-normal mt-0.5">{{ m.notes }}</div>
              </td>
              <td>
                <span
                  class="badge"
                  :class="m.acquisition === 'purchased' ? 'bg-amber-100 text-amber-800' : 'bg-teal-500/10 text-teal-700'"
                >
                  {{ acquisitionLabel(m) }}
                </span>
              </td>
              <td class="num">{{ machineQty(m) }}</td>
              <td class="num">{{ formatIDR(m.purchasePrice) }}</td>
              <td class="num font-medium">{{ formatIDR(machineTotal(m)) }}</td>
              <td class="whitespace-nowrap font-mono text-xs">{{ m.purchaseDate ? formatDate(m.purchaseDate) : '—' }}</td>
              <td class="whitespace-nowrap text-right">
                <div v-if="isAdmin" class="btn-actions justify-end">
                  <button class="btn-action" @click="openEdit(m)"><PencilSquareIcon class="w-3.5 h-3.5" />Edit</button>
                  <button class="btn-action-danger" @click="remove(m)"><TrashIcon class="w-3.5 h-3.5" />Hapus</button>
                </div>
                <span v-else class="text-ink-300 text-xs">—</span>
              </td>
            </tr>
            <tr v-if="!total">
              <td colspan="8" class="text-center text-ink-500 py-6">
                {{ search ? 'Tidak ada peralatan yang cocok.' : 'Belum ada peralatan.' }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <AppPagination
        v-model:page="page"
        v-model:pageSize="pageSize"
        :total-pages="totalPages"
        :total="total"
        :range-start="rangeStart"
        :range-end="rangeEnd"
      />
    </div>

    <AppModal v-if="showForm" :title="editing ? 'Edit Peralatan' : 'Tambah Peralatan'" @close="((showForm = false), refresh())">
      <form class="space-y-3" @submit.prevent="save">
        <div v-if="editing" class="flex gap-4 items-start">
          <ImageUploader
            :src="`/api/machines/${editing.id}/image`"
            :has-image="!!editing.imageKey"
            :upload-url="`/api/machines/${editing.id}/image`"
            @changed="refresh()"
          />
          <p class="text-xs text-ink-500 pt-1">Foto opsional, misalnya tangga, splicer, atau bor.</p>
        </div>
        <div>
          <label class="label">Nama</label>
          <input v-model="form.name" class="input" required placeholder="Fusion splicer, tangga, bor…" />
        </div>
        <fieldset class="space-y-2">
          <legend class="label">Asal alat</legend>
          <label class="flex items-start gap-3 cursor-pointer rounded-panel border border-ink-200 p-3">
            <input v-model="form.acquisition" type="radio" value="owned" class="mt-1" />
            <span>
              <span class="block text-sm font-medium">Sudah dimiliki (modal / aset)</span>
              <span class="block text-xs text-ink-500 mt-0.5">Usaha sudah jalan, alat ini sudah ada. Tidak potong kas.</span>
            </span>
          </label>
          <label class="flex items-start gap-3 cursor-pointer rounded-panel border border-ink-200 p-3">
            <input v-model="form.acquisition" type="radio" value="purchased" class="mt-1" />
            <span>
              <span class="block text-sm font-medium">Beli baru (pengeluaran)</span>
              <span class="block text-xs text-ink-500 mt-0.5">Kas keluar. Otomatis tercatat di Pengeluaran, kategori Peralatan.</span>
            </span>
          </label>
        </fieldset>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label class="label">Harga satuan</label>
            <IdrInput v-model="form.purchasePrice" required />
          </div>
          <div>
            <label class="label">Qty</label>
            <input v-model.number="form.quantity" type="number" min="1" step="1" class="input-num" required />
          </div>
        </div>
        <div class="rounded-panel border border-ink-200 bg-ink-50 p-3 text-sm flex justify-between gap-2">
          <span class="text-ink-500">Nilai tercatat</span>
          <span class="font-mono font-semibold">{{ formatIDR(formTotal) }}</span>
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div class="date-field">
            <label class="label">Tanggal</label>
            <input v-model="form.purchaseDate" type="date" class="input" />
          </div>
          <div class="min-w-0">
            <label class="label">Umur pakai (bulan)</label>
            <input v-model.number="form.depreciationMonths" type="number" min="1" class="input-num" required />
          </div>
        </div>
        <div>
          <label class="label">Catatan</label>
          <input v-model="form.notes" class="input" placeholder="opsional" />
        </div>
        <p v-if="errorMsg" class="text-sm text-red-600">{{ errorMsg }}</p>
        <div class="flex justify-end gap-2 pt-2">
          <button type="button" class="btn-secondary" @click="((showForm = false), refresh())">
            <XMarkIcon class="w-4 h-4" />{{ editing ? 'Tutup' : 'Batal' }}
          </button>
          <button type="submit" class="btn-primary"><CheckIcon class="w-4 h-4" />Simpan</button>
        </div>
      </form>
    </AppModal>
  </div>
</template>
