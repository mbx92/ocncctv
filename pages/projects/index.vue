<script setup>
import {
  PlusIcon,
  PencilSquareIcon,
  TrashIcon,
  CheckIcon,
  XMarkIcon,
  MagnifyingGlassIcon,
  ArrowPathIcon
} from '@heroicons/vue/24/outline'
import { PRODUCT_STATUSES, productStatusLabel, productStatusClass } from '~/utils/productStatus.js'

const { data: products, refresh } = await useFetch('/api/products')
const isAdmin = computed(() => useState('authUser').value?.role === 'admin')

const statusLabel = productStatusLabel

const search = ref('')
const statusFilter = ref('')
const filteredProducts = computed(() => {
  const q = search.value.trim().toLowerCase()
  return (products.value || []).filter((p) => {
    if (statusFilter.value && p.status !== statusFilter.value) return false
    if (!q) return true
    return (
      p.name.toLowerCase().includes(q) ||
      (p.description || '').toLowerCase().includes(q) ||
      (p.customerName || '').toLowerCase().includes(q)
    )
  })
})
const { page, pageSize, paged, total, totalPages, rangeStart, rangeEnd, reset } = usePagination(
  filteredProducts,
  10
)
watch([search, statusFilter], reset)

const showForm = ref(false)
const form = ref({})
const errorMsg = ref('')
const syncing = ref(false)

async function syncErp() {
  if (syncing.value) return
  syncing.value = true
  try {
    const data = await $fetch('/api/projects/sync-erp', { method: 'POST', timeout: 120000 })
    await refresh()
    useToast().success(data.message || 'Sync ERP selesai.')
  } catch (e) {
    useToast().error(e.data?.statusMessage || 'Gagal sync dari ERP')
  } finally {
    syncing.value = false
  }
}

function openAdd() {
  form.value = { name: '', description: '' }
  errorMsg.value = ''
  showForm.value = true
}
async function save() {
  errorMsg.value = ''
  try {
    const p = await $fetch('/api/products', { method: 'POST', body: form.value })
    showForm.value = false
    await navigateTo(`/projects/${p.id}`)
  } catch (e) {
    errorMsg.value = e.data?.statusMessage || 'Gagal menyimpan'
  }
}
async function remove(p) {
  if (!(await useConfirm().confirm(`Hapus proyek "${p.name}"?`))) return
  try {
    await $fetch(`/api/products/${p.id}`, { method: 'DELETE' })
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
        <h1 class="text-xl font-bold">Proyek</h1>
        <p class="text-xs text-ink-500">Pekerjaan pemasangan dari RAB Deal atau sync proyek selesai dari ERP.</p>
      </div>
      <div class="flex items-center gap-2">
        <button v-if="isAdmin" type="button" class="btn-secondary" :disabled="syncing" @click="syncErp">
          <ArrowPathIcon class="w-4 h-4" :class="syncing ? 'animate-spin' : ''" />
          <span class="hidden sm:inline">{{ syncing ? 'Sync ERP…' : 'Sync ERP' }}</span>
          <span class="sm:hidden">{{ syncing ? '…' : 'ERP' }}</span>
        </button>
        <button v-if="isAdmin" class="btn-primary" @click="openAdd">
          <PlusIcon class="w-4 h-4" /><span class="hidden sm:inline">Tambah Proyek</span><span class="sm:hidden">Tambah</span>
        </button>
      </div>
    </div>

    <div class="flex flex-col sm:flex-row flex-wrap gap-2">
      <div class="relative w-full sm:flex-1 sm:min-w-[12rem] md:max-w-xs">
        <MagnifyingGlassIcon class="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-ink-400 pointer-events-none" />
        <input
          v-model="search"
          class="input pl-9 w-full"
          type="search"
          enterkeyhint="search"
          autocomplete="off"
          placeholder="Cari nama atau deskripsi…"
        />
      </div>
      <select v-model="statusFilter" class="input w-full sm:w-40">
        <option value="">Semua status</option>
        <option v-for="s in PRODUCT_STATUSES" :key="s" :value="s">{{ statusLabel[s] }}</option>
      </select>
    </div>

    <!-- Tabel (desktop) -->
    <div class="panel hidden md:block">
      <div class="overflow-x-auto">
        <table class="table-std">
          <thead>
            <tr>
              <th>Proyek</th>
              <th>Status</th>
              <th class="text-right">Pendapatan</th>
              <th class="text-right">Laba</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="p in paged" :key="p.id">
              <td>
                <NuxtLink :to="`/projects/${p.id}`" class="font-medium text-ink-900 hover:text-accent-600">
                  {{ p.name }}
                </NuxtLink>
                <div v-if="p.customerName || p.description" class="text-xs text-ink-400">
                  {{ p.customerName || p.description }}
                </div>
                <div v-if="p.erpProjectId" class="text-[10px] uppercase tracking-wide text-ink-400 mt-0.5">Dari ERP</div>
              </td>
              <td><span class="badge" :class="productStatusClass(p.status)">{{ statusLabel[p.status] }}</span></td>
              <td class="num">
                <span v-if="p.hasRab">{{ formatIDR(p.revenue) }}</span>
                <span v-else class="text-ink-400 text-xs">tanpa RAB</span>
              </td>
              <td class="num">
                <span v-if="p.hasRab" :class="(p.profit || 0) >= 0 ? '' : 'text-red-600'">{{ formatIDR(p.profit) }}</span>
                <span v-else class="text-ink-400 text-xs">—</span>
              </td>
              <td class="whitespace-nowrap text-right">
                <div class="btn-actions justify-end">
                  <NuxtLink :to="`/projects/${p.id}?tab=items`" class="btn-action">
                    <PencilSquareIcon class="w-3.5 h-3.5" />{{ isAdmin ? 'Item' : 'Lihat' }}
                  </NuxtLink>
                  <button v-if="isAdmin" class="btn-action-danger" @click="remove(p)">
                    <TrashIcon class="w-3.5 h-3.5" />Hapus
                  </button>
                </div>
              </td>
            </tr>
            <tr v-if="!total">
              <td colspan="5" class="text-center text-ink-500 py-6">
                {{ search || statusFilter ? 'Tidak ada proyek yang cocok.' : 'Belum ada proyek.' }}
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

    <!-- Kartu (mobile) -->
    <div class="md:hidden space-y-2">
      <div v-for="p in paged" :key="p.id" class="panel p-3 space-y-1">
        <div class="flex items-start justify-between gap-2">
          <NuxtLink :to="`/projects/${p.id}`" class="font-medium break-words hover:text-accent-600">{{ p.name }}</NuxtLink>
          <span class="badge shrink-0" :class="productStatusClass(p.status)">{{ statusLabel[p.status] }}</span>
        </div>
        <div class="text-sm font-mono">
          <span v-if="p.hasRab">Pendapatan {{ formatIDR(p.revenue) }} · Laba {{ formatIDR(p.profit) }}</span>
          <span v-else-if="p.erpProjectId" class="text-ink-400 text-xs">Dari ERP{{ p.customerName ? ` · ${p.customerName}` : '' }}</span>
          <span v-else class="text-ink-400 text-xs">Belum terkait RAB</span>
        </div>
        <div class="btn-actions pt-1">
          <NuxtLink :to="`/projects/${p.id}?tab=items`" class="btn-action">
            <PencilSquareIcon class="w-3.5 h-3.5" />{{ isAdmin ? 'Item' : 'Lihat' }}
          </NuxtLink>
          <button v-if="isAdmin" class="btn-action-danger" @click="remove(p)">
            <TrashIcon class="w-3.5 h-3.5" />Hapus
          </button>
        </div>
      </div>
      <p v-if="!total" class="panel p-6 text-center text-sm text-ink-500">
        {{ search || statusFilter ? 'Tidak ada proyek yang cocok.' : 'Belum ada proyek.' }}
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

    <AppModal v-if="showForm" title="Tambah Proyek" @close="showForm = false">
      <form class="space-y-3" @submit.prevent="save">
        <div>
          <label class="label">Nama</label>
          <input v-model="form.name" class="input" required placeholder="Pemasangan 4 kamera rumah…" />
        </div>
        <div>
          <label class="label">Deskripsi</label>
          <input v-model="form.description" class="input" placeholder="opsional" />
        </div>
        <p class="text-xs text-ink-500">Proyek baru berstatus Menunggu sampai diklik Mulai.</p>
        <p v-if="errorMsg" class="text-sm text-red-600">{{ errorMsg }}</p>
        <div class="flex justify-end gap-2 pt-2">
          <button type="button" class="btn-secondary" @click="showForm = false"><XMarkIcon class="w-4 h-4" />Batal</button>
          <button type="submit" class="btn-primary"><CheckIcon class="w-4 h-4" />Simpan</button>
        </div>
      </form>
    </AppModal>
  </div>
</template>
