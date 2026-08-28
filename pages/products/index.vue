<script setup>
import { PlusIcon, PencilSquareIcon, TrashIcon, CheckIcon, XMarkIcon, MagnifyingGlassIcon, PhotoIcon } from '@heroicons/vue/24/outline'

const { data: items, refresh } = await useFetch('/api/packaging')
const { data: suppliers, refresh: refreshSuppliers } = await useFetch('/api/suppliers')
const isAdmin = computed(() => useState('authUser').value?.role === 'admin')

const search = ref('')
const filteredItems = computed(() => {
  const q = search.value.trim().toLowerCase()
  if (!q) return items.value || []
  return (items.value || []).filter(
    (p) => p.name.toLowerCase().includes(q) || (p.supplier || '').toLowerCase().includes(q)
  )
})
const { page, pageSize, paged, total, totalPages, rangeStart, rangeEnd, reset } = usePagination(
  filteredItems,
  10
)
watch(search, reset)

const showForm = ref(false)
const showSuppliers = ref(false)
const editing = ref(null)
const form = ref({})
const errorMsg = ref('')

const knownSupplierNames = computed(() => new Set((suppliers.value || []).map((s) => s.name)))
const orphanSupplier = computed(() => {
  const name = form.value.supplier
  if (!name) return ''
  return knownSupplierNames.value.has(name) ? '' : name
})

function openAdd() {
  editing.value = null
  form.value = { name: '', unit: 'pcs', pricePerUnit: 0, stockQuantity: 0, supplier: '' }
  showForm.value = true
}
function openEdit(p) {
  editing.value = p
  form.value = { ...p }
  showForm.value = true
}
async function save() {
  errorMsg.value = ''
  try {
    if (editing.value) {
      await $fetch(`/api/packaging/${editing.value.id}`, { method: 'PUT', body: form.value })
      useToast().success('Produk diperbarui.')
    } else {
      await $fetch('/api/packaging', { method: 'POST', body: form.value })
      useToast().success('Produk tersimpan.')
    }
    showForm.value = false
    editing.value = null
    await refresh()
  } catch (e) {
    errorMsg.value = e.data?.statusMessage || 'Gagal menyimpan'
  }
}
function closeSuppliers() {
  showSuppliers.value = false
  refreshSuppliers()
}

async function onSupplierCreated(created) {
  await refreshSuppliers()
  if (created?.name) form.value.supplier = created.name
}

async function remove(p) {
  if (!(await useConfirm().confirm(`Hapus produk "${p.name}"?`))) return
  try {
    await $fetch(`/api/packaging/${p.id}`, { method: 'DELETE' })
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
        <h1 class="text-xl font-bold">Produk</h1>
        <p class="text-sm text-ink-500">Barang yang dijual atau distok (kamera, kabel, NVR). Perlengkapan pasang ada di menu Perlengkapan.</p>
      </div>
      <button v-if="isAdmin" class="btn-primary" @click="openAdd">
        <PlusIcon class="w-4 h-4" /><span class="hidden sm:inline">Tambah Produk</span><span class="sm:hidden">Tambah</span>
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
        placeholder="Cari nama atau supplier…"
      />
    </div>

    <!-- Kartu (mobile) -->
    <div class="md:hidden space-y-2">
      <div v-for="p in paged" :key="p.id" class="panel p-3 flex gap-3">
        <div class="w-14 h-14 rounded border border-ink-200 bg-ink-50 overflow-hidden shrink-0 flex items-center justify-center">
          <img v-if="p.imageKey" :src="`/api/packaging/${p.id}/image`" alt="" class="w-full h-full object-cover" />
          <PhotoIcon v-else class="w-5 h-5 text-ink-300" />
        </div>
        <div class="min-w-0 flex-1 space-y-1">
          <div class="font-medium break-words">{{ p.name }}</div>
          <div class="text-sm font-mono">{{ formatIDR(p.pricePerUnit) }}/{{ p.unit }}</div>
          <div class="text-sm font-mono" :class="p.stockQuantity < 10 ? 'text-amber-600 font-semibold' : 'text-ink-500'">
            Stok {{ formatNumber(p.stockQuantity, 1) }} {{ p.unit }}
          </div>
          <div class="text-xs text-ink-400">{{ p.supplier || 'tanpa supplier' }}</div>
          <div v-if="isAdmin" class="btn-actions pt-1">
            <button class="btn-action" @click="openEdit(p)"><PencilSquareIcon class="w-3.5 h-3.5" />Edit</button>
            <button class="btn-action-danger" @click="remove(p)"><TrashIcon class="w-3.5 h-3.5" />Hapus</button>
          </div>
        </div>
      </div>
      <p v-if="!total" class="panel p-6 text-center text-sm text-ink-500">
        {{ search ? 'Tidak ada produk yang cocok.' : 'Belum ada produk.' }}
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
            <th class="text-right">Harga / unit</th>
            <th class="text-right">Stok</th>
            <th>Supplier</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="p in paged" :key="p.id">
            <td>
              <div class="w-10 h-10 rounded border border-ink-200 bg-ink-50 overflow-hidden flex items-center justify-center">
                <img v-if="p.imageKey" :src="`/api/packaging/${p.id}/image`" alt="" class="w-full h-full object-cover" />
                <PhotoIcon v-else class="w-4 h-4 text-ink-300" />
              </div>
            </td>
            <td class="font-medium">{{ p.name }}</td>
              <td class="num">{{ formatIDR(p.pricePerUnit) }}/{{ p.unit }}</td>
              <td class="num" :class="p.stockQuantity < 10 ? 'text-amber-600 font-semibold' : ''">
                {{ formatNumber(p.stockQuantity, 1) }} {{ p.unit }}
              </td>
              <td class="text-ink-500">{{ p.supplier || '-' }}</td>
              <td class="whitespace-nowrap text-right">
                <div v-if="isAdmin" class="btn-actions justify-end">
                  <button class="btn-action" @click="openEdit(p)"><PencilSquareIcon class="w-3.5 h-3.5" />Edit</button>
                  <button class="btn-action-danger" @click="remove(p)"><TrashIcon class="w-3.5 h-3.5" />Hapus</button>
                </div>
                <span v-else class="text-ink-300 text-xs">—</span>
              </td>
            </tr>
          <tr v-if="!total">
            <td colspan="6" class="text-center text-ink-500 py-6">
              {{ search ? 'Tidak ada produk yang cocok.' : 'Belum ada produk.' }}
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

    <AppModal v-if="showForm" :title="editing ? 'Edit Produk' : 'Tambah Produk'" @close="((showForm = false), refresh())">
      <form class="space-y-3" @submit.prevent="save">
        <div v-if="editing" class="flex gap-4 items-start">
          <ImageUploader
            :src="`/api/packaging/${editing.id}/image`"
            :has-image="!!editing.imageKey"
            :upload-url="`/api/packaging/${editing.id}/image`"
            @changed="refresh()"
          />
          <p class="text-xs text-ink-500 pt-1">
            Gambar membantu membedakan jenis produk saat memilih di proyek / RAB.
          </p>
        </div>
        <div>
          <label class="label">Nama</label>
          <input v-model="form.name" class="input" required placeholder="Kamera 4MP, kabel UTP 305 m…" />
        </div>
        <div class="grid grid-cols-3 gap-3">
          <div>
            <label class="label">Unit</label>
            <input v-model="form.unit" class="input" placeholder="pcs / meter" required />
          </div>
          <div>
            <label class="label">Harga per unit</label>
            <IdrInput v-model="form.pricePerUnit" required />
          </div>
          <div>
            <label class="label">Stok</label>
            <input v-model.number="form.stockQuantity" type="number" min="0" step="0.1" class="input-num" />
          </div>
        </div>
        <div>
          <label class="label">Supplier</label>
          <div class="flex gap-2 min-w-0">
            <select v-model="form.supplier" class="input min-w-0">
              <option value="">Tanpa supplier</option>
              <option v-if="orphanSupplier" :value="orphanSupplier">{{ orphanSupplier }}</option>
              <option v-for="s in suppliers" :key="s.id" :value="s.name">{{ s.name }}</option>
            </select>
            <button type="button" class="btn-secondary shrink-0" title="Kelola supplier" @click="showSuppliers = true">
              <PlusIcon class="w-4 h-4" />
            </button>
          </div>
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

    <SupplierManageModal
      v-if="showSuppliers"
      nested
      @close="closeSuppliers"
      @created="onSupplierCreated"
      @changed="refreshSuppliers"
    />
  </div>
</template>
