<script setup>
import {
  PlusIcon,
  TrashIcon,
  ArrowPathIcon,
  ShareIcon,
  CheckIcon,
  XMarkIcon
} from '@heroicons/vue/24/outline'

const { data: packages, refresh } = await useFetch('/api/packages')

const { page, pageSize, paged, total, totalPages, rangeStart, rangeEnd, reset } = usePagination(
  computed(() => packages.value || []),
  10
)
watch(packages, reset)

const showForm = ref(false)
const form = ref({ name: '', description: '' })
const errorMsg = ref('')
const saving = ref(false)
const syncingId = ref(null)
const sharingId = ref(null)

function openAdd() {
  form.value = { name: '', description: '' }
  errorMsg.value = ''
  showForm.value = true
}

async function save() {
  errorMsg.value = ''
  saving.value = true
  try {
    const created = await $fetch('/api/packages', { method: 'POST', body: form.value })
    showForm.value = false
    await navigateTo(`/packages/${created.id}`)
  } catch (e) {
    errorMsg.value = e.data?.statusMessage || 'Gagal menyimpan'
  } finally {
    saving.value = false
  }
}

async function syncPrices(row) {
  syncingId.value = row.id
  try {
    await $fetch(`/api/packages/${row.id}/sync`, { method: 'POST' })
    await refresh()
    useToast().success(`Harga "${row.name}" diperbarui dari katalog/produk.`)
  } catch (e) {
    useToast().error(e.data?.statusMessage || 'Gagal sync harga')
  } finally {
    syncingId.value = null
  }
}

async function sharePackage(row) {
  sharingId.value = row.id
  try {
    const res = await $fetch(`/api/packages/${row.id}/share`, { method: 'POST' })
    const url = `${window.location.origin}${res.path}`
    if (navigator.share) {
      try {
        await navigator.share({ title: row.name, text: `Paket ${row.name}`, url })
        return
      } catch (e) {
        if (e?.name === 'AbortError') return
      }
    }
    await navigator.clipboard.writeText(url)
    useToast().success('Tautan paket disalin.')
  } catch (e) {
    useToast().error(e.data?.statusMessage || 'Gagal membuat tautan')
  } finally {
    sharingId.value = null
  }
}

async function remove(row) {
  if (!(await useConfirm().confirm(`Hapus paket "${row.name}"?`))) return
  try {
    await $fetch(`/api/packages/${row.id}`, { method: 'DELETE' })
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
        <h1 class="text-xl font-bold">Paket</h1>
        <p class="text-sm text-ink-500">
          Bundel siap-share ke pelanggan. Sync harga dari katalog atau produk stok. Stok tidak terpotong.
        </p>
      </div>
      <button class="btn-primary" @click="openAdd">
        <PlusIcon class="w-4 h-4" /><span class="hidden sm:inline">Tambah Paket</span><span class="sm:hidden">Tambah</span>
      </button>
    </div>

    <div class="md:hidden space-y-2">
      <div v-for="row in paged" :key="row.id" class="panel p-3 space-y-2">
        <NuxtLink :to="`/packages/${row.id}`" class="block">
          <div class="font-medium">{{ row.name }}</div>
          <div class="text-xs text-ink-500 mt-0.5">
            {{ row.lineCount }} item · {{ formatIDR(row.totalSale) }}
          </div>
        </NuxtLink>
        <div class="btn-actions">
          <button type="button" class="btn-action" :disabled="syncingId === row.id" @click="syncPrices(row)">
            <ArrowPathIcon class="w-3.5 h-3.5" />{{ syncingId === row.id ? 'Sync…' : 'Sync' }}
          </button>
          <button type="button" class="btn-action" :disabled="sharingId === row.id" @click="sharePackage(row)">
            <ShareIcon class="w-3.5 h-3.5" />Bagikan
          </button>
          <button type="button" class="btn-action-danger" @click="remove(row)">
            <TrashIcon class="w-3.5 h-3.5" />Hapus
          </button>
        </div>
      </div>
      <p v-if="!total" class="panel p-6 text-center text-sm text-ink-500">Belum ada paket.</p>
    </div>

    <div class="panel hidden md:block">
      <div class="overflow-x-auto">
        <table class="table-std">
          <thead>
            <tr>
              <th>Paket</th>
              <th class="text-right">Item</th>
              <th class="text-right">Harga</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in paged" :key="row.id">
              <td>
                <NuxtLink :to="`/packages/${row.id}`" class="font-medium hover:underline">{{ row.name }}</NuxtLink>
                <div v-if="row.description" class="text-xs text-ink-400">{{ row.description }}</div>
              </td>
              <td class="num">{{ row.lineCount }}</td>
              <td class="num">{{ formatIDR(row.totalSale) }}</td>
              <td class="text-right">
                <div class="btn-actions justify-end">
                  <button type="button" class="btn-action" :disabled="syncingId === row.id" @click="syncPrices(row)">
                    <ArrowPathIcon class="w-3.5 h-3.5" />{{ syncingId === row.id ? 'Sync…' : 'Sync' }}
                  </button>
                  <button type="button" class="btn-action" :disabled="sharingId === row.id" @click="sharePackage(row)">
                    <ShareIcon class="w-3.5 h-3.5" />Bagikan
                  </button>
                  <button type="button" class="btn-action-danger" @click="remove(row)">
                    <TrashIcon class="w-3.5 h-3.5" />Hapus
                  </button>
                </div>
              </td>
            </tr>
            <tr v-if="!total">
              <td colspan="4" class="text-center text-ink-500 py-6">Belum ada paket.</td>
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

    <AppModal v-if="showForm" title="Paket baru" @close="showForm = false">
      <form class="space-y-3" @submit.prevent="save">
        <div>
          <label class="label">Nama paket</label>
          <input v-model="form.name" class="input" required placeholder="Paket 4 kamera indoor" />
        </div>
        <div>
          <label class="label">Deskripsi (opsional)</label>
          <input v-model="form.description" class="input" placeholder="Tampil di tautan pelanggan" />
        </div>
        <p v-if="errorMsg" class="text-sm text-red-600">{{ errorMsg }}</p>
        <div class="flex justify-end gap-2">
          <button type="button" class="btn-secondary" @click="showForm = false"><XMarkIcon class="w-4 h-4" />Batal</button>
          <button type="submit" class="btn-primary" :disabled="saving">
            <CheckIcon class="w-4 h-4" />{{ saving ? 'Menyimpan…' : 'Lanjut' }}
          </button>
        </div>
      </form>
    </AppModal>
  </div>
</template>
