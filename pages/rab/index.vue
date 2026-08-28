<script setup>
import { PlusIcon, TrashIcon, CheckIcon, XMarkIcon, EyeIcon, DocumentTextIcon } from '@heroicons/vue/24/outline'
import { RAB_STATUSES, rabStatusLabel, rabStatusBadge } from '~/utils/rab.js'

const filters = ref({ status: '', dateFrom: '', dateTo: '' })
const query = computed(() => {
  const q = {}
  for (const [k, v] of Object.entries(filters.value)) if (v) q[k] = v
  return q
})
const { data: orders, refresh } = await useFetch('/api/custom-orders', { query })

const { page, pageSize, paged, total, totalPages, rangeStart, rangeEnd, reset } = usePagination(
  computed(() => orders.value || []),
  10
)
watch(query, reset, { deep: true })

const showForm = ref(false)
const form = ref({})
const errorMsg = ref('')
const saving = ref(false)

function openAdd() {
  form.value = {
    date: todayStr(),
    customerName: '',
    title: '',
    notes: ''
  }
  errorMsg.value = ''
  showForm.value = true
}

async function save() {
  errorMsg.value = ''
  saving.value = true
  try {
    const created = await $fetch('/api/custom-orders', { method: 'POST', body: form.value })
    showForm.value = false
    await navigateTo(`/rab/${created.id}`)
  } catch (e) {
    errorMsg.value = e.data?.statusMessage || 'Gagal menyimpan'
  } finally {
    saving.value = false
  }
}

async function remove(row) {
  if (row.projectId) {
    useToast().error('RAB yang sudah Deal tidak bisa dihapus')
    return
  }
  if (!(await useConfirm().confirm(`Hapus RAB "${row.title}" milik ${row.customerName}?`, { title: 'Hapus RAB' }))) return
  try {
    await $fetch(`/api/custom-orders/${row.id}`, { method: 'DELETE' })
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
        <h1 class="text-xl font-bold">RAB</h1>
        <p class="text-xs text-ink-500">
          Penawaran ke pelanggan dari katalog, produk stok, atau jasa. Belum Deal = belum proyek. Kas dan stok tidak bergerak.
        </p>
      </div>
      <button class="btn-primary" @click="openAdd">
        <PlusIcon class="w-4 h-4" /><span class="hidden sm:inline">Tambah RAB</span><span class="sm:hidden">Catat</span>
      </button>
    </div>

    <div class="panel p-3 grid grid-cols-1 sm:grid-cols-3 gap-2">
      <div>
        <label class="label">Status</label>
        <select v-model="filters.status" class="input">
          <option value="">Semua</option>
          <option v-for="s in RAB_STATUSES" :key="s" :value="s">{{ rabStatusLabel[s] }}</option>
        </select>
      </div>
      <div>
        <label class="label">Dari</label>
        <input v-model="filters.dateFrom" type="date" class="input" />
      </div>
      <div>
        <label class="label">Sampai</label>
        <input v-model="filters.dateTo" type="date" class="input" />
      </div>
    </div>

    <div class="md:hidden space-y-2">
      <NuxtLink v-for="row in paged" :key="row.id" :to="`/rab/${row.id}`" class="panel p-3 block space-y-1">
        <div class="flex items-start justify-between gap-2">
          <span class="font-medium break-words">{{ row.title }}</span>
          <span class="badge shrink-0" :class="rabStatusBadge[row.status]">{{ rabStatusLabel[row.status] }}</span>
        </div>
        <div class="text-xs text-ink-500">{{ row.customerName }} · {{ formatDate(row.date) }}</div>
        <div class="text-xs font-mono text-ink-400">{{ formatIDR(row.totalSale) }}</div>
      </NuxtLink>
      <p v-if="!total" class="panel p-6 text-center text-sm text-ink-500">Belum ada RAB.</p>
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
              <th>Tanggal</th>
              <th>Pelanggan</th>
              <th>Judul</th>
              <th class="text-right">Harga jual</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in paged" :key="row.id">
              <td class="whitespace-nowrap font-mono text-xs">{{ formatDate(row.date) }}</td>
              <td>{{ row.customerName }}</td>
              <td>
                <NuxtLink :to="`/rab/${row.id}`" class="font-medium hover:underline">{{ row.title }}</NuxtLink>
              </td>
              <td class="num">{{ formatIDR(row.totalSale) }}</td>
              <td><span class="badge" :class="rabStatusBadge[row.status]">{{ rabStatusLabel[row.status] }}</span></td>
              <td class="text-right whitespace-nowrap">
                <div class="btn-actions justify-end">
                  <NuxtLink :to="`/rab/${row.id}`" class="btn-action"><EyeIcon class="w-3.5 h-3.5" />Detail</NuxtLink>
                  <NuxtLink :to="`/rab/${row.id}/quote`" class="btn-action">
                    <DocumentTextIcon class="w-3.5 h-3.5" />Penawaran
                  </NuxtLink>
                  <button
                    v-if="!row.projectId"
                    class="btn-action-danger"
                    @click="remove(row)"
                  >
                    <TrashIcon class="w-3.5 h-3.5" />Hapus
                  </button>
                </div>
              </td>
            </tr>
            <tr v-if="!total">
              <td colspan="6" class="text-center text-ink-500 py-6">Belum ada RAB.</td>
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

    <AppModal v-if="showForm" title="RAB baru" @close="showForm = false">
      <form class="space-y-3" @submit.prevent="save">
        <div class="date-field">
          <label class="label">Tanggal</label>
          <input v-model="form.date" type="date" class="input" required />
        </div>
        <div>
          <label class="label">Nama pelanggan</label>
          <input v-model="form.customerName" class="input" required placeholder="nama / toko" />
        </div>
        <div>
          <label class="label">Judul pekerjaan</label>
          <input v-model="form.title" class="input" required placeholder="mis. pasang CCTV 8 channel gudang" />
        </div>
        <div>
          <label class="label">Catatan</label>
          <input v-model="form.notes" class="input" placeholder="opsional" />
        </div>
        <p class="text-xs text-ink-500">Setelah simpan, isi barang katalog dan jasa di halaman detail.</p>
        <p v-if="errorMsg" class="text-sm text-red-600">{{ errorMsg }}</p>
        <div class="flex justify-end gap-2 pt-2">
          <button type="button" class="btn-secondary" @click="showForm = false"><XMarkIcon class="w-4 h-4" />Batal</button>
          <button type="submit" class="btn-primary" :disabled="saving">
            <CheckIcon class="w-4 h-4" />{{ saving ? 'Menyimpan…' : 'Simpan & isi item' }}
          </button>
        </div>
      </form>
    </AppModal>
  </div>
</template>
