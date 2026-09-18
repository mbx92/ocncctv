<script setup>
import { PlusIcon, PencilSquareIcon, TrashIcon, CheckIcon, XMarkIcon } from '@heroicons/vue/24/outline'
import { roleLabel, roleBadge } from '~/utils/roles.js'

const { data: users, refresh } = await useFetch('/api/users')
const { data: technicians } = await useFetch('/api/technicians')
const authUser = useState('authUser')

const { page, pageSize, paged, total, totalPages, rangeStart, rangeEnd } = usePagination(
  computed(() => users.value || []),
  10
)

const showForm = ref(false)
const editing = ref(null)
const form = ref({})
const errorMsg = ref('')

function emptyForm() {
  return { username: '', password: '', role: 'staff', technicianId: '' }
}

function openAdd() {
  editing.value = null
  form.value = emptyForm()
  errorMsg.value = ''
  showForm.value = true
}
function openEdit(u) {
  editing.value = u
  form.value = {
    username: u.username,
    password: '',
    role: u.role,
    technicianId: u.technicianId != null ? String(u.technicianId) : ''
  }
  errorMsg.value = ''
  showForm.value = true
}

const usedTechnicianIds = computed(() => {
  const editingId = editing.value?.id
  return new Set(
    (users.value || [])
      .filter((u) => u.technicianId && u.id !== editingId)
      .map((u) => String(u.technicianId))
  )
})

const technicianOptions = computed(() => {
  const current = form.value.technicianId
  return (technicians.value || []).filter(
    (t) => String(t.id) === String(current) || !usedTechnicianIds.value.has(String(t.id))
  )
})

watch(
  () => form.value.role,
  (role) => {
    if (role !== 'technician') form.value.technicianId = ''
  }
)

async function save() {
  errorMsg.value = ''
  try {
    const body = {
      username: form.value.username,
      password: form.value.password,
      role: form.value.role,
      technicianId: form.value.role === 'technician' ? Number(form.value.technicianId) || null : null
    }
    if (editing.value) {
      await $fetch(`/api/users/${editing.value.id}`, { method: 'PUT', body })
    } else {
      await $fetch('/api/users', { method: 'POST', body })
    }
    showForm.value = false
    await refresh()
  } catch (e) {
    errorMsg.value = e.data?.statusMessage || 'Gagal menyimpan'
  }
}
async function remove(u) {
  if (!(await useConfirm().confirm(`Hapus user "${u.username}"?`))) return
  try {
    await $fetch(`/api/users/${u.id}`, { method: 'DELETE' })
    await refresh()
  } catch (e) {
    useToast().error(e.data?.statusMessage || 'Gagal menghapus')
  }
}
</script>

<template>
  <div class="space-y-4">
    <div class="flex items-center justify-between gap-2">
      <p class="text-xs text-ink-500">
        Admin: akses penuh. Staff: operasional. Teknisi: hanya melihat proyek dan upah sendiri.
      </p>
      <button class="btn-primary shrink-0" @click="openAdd">
        <PlusIcon class="w-4 h-4" /><span class="hidden sm:inline">Tambah User</span><span class="sm:hidden">Tambah</span>
      </button>
    </div>

    <div class="panel">
      <div class="overflow-x-auto">
        <table class="table-std">
          <thead>
            <tr>
              <th>Username</th>
              <th>Role</th>
              <th>Teknisi</th>
              <th>Dibuat</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="u in paged" :key="u.id">
              <td class="font-medium">
                {{ u.username }}
                <span v-if="u.id === authUser?.id" class="text-xs text-ink-400">(kamu)</span>
              </td>
              <td>
                <span class="badge" :class="roleBadge[u.role] || roleBadge.staff">{{ roleLabel[u.role] || u.role }}</span>
              </td>
              <td class="text-sm text-ink-600">{{ u.technicianName || '—' }}</td>
              <td class="text-sm text-ink-500">{{ formatDate(u.createdAt) }}</td>
              <td class="whitespace-nowrap text-right">
                <div class="btn-actions justify-end">
                  <button class="btn-action" @click="openEdit(u)"><PencilSquareIcon class="w-3.5 h-3.5" />Edit</button>
                  <button
                    class="btn-action-danger"
                    :disabled="u.id === authUser?.id"
                    @click="remove(u)"
                  >
                    <TrashIcon class="w-3.5 h-3.5" />Hapus
                  </button>
                </div>
              </td>
            </tr>
            <tr v-if="!total">
              <td colspan="5" class="text-center text-ink-500 py-6">Belum ada user.</td>
            </tr>
          </tbody>
        </table>
      </div>
      <AppPagination
        v-model:page="page"
        v-model:pageSize="pageSize"
        :total-pages="totalPages"
        :range-start="rangeStart"
        :range-end="rangeEnd"
        :total="total"
      />
    </div>

    <AppModal v-if="showForm" :title="editing ? 'Edit User' : 'Tambah User'" @close="showForm = false">
      <form class="space-y-3" @submit.prevent="save">
        <div>
          <label class="label">Username</label>
          <input v-model="form.username" class="input" required placeholder="staff1" />
        </div>
        <div>
          <label class="label">{{ editing ? 'Password baru (kosongkan jika tidak diganti)' : 'Password' }}</label>
          <input v-model="form.password" type="password" class="input" :required="!editing" placeholder="Minimal 6 karakter" />
        </div>
        <div>
          <label class="label">Role</label>
          <select v-model="form.role" class="input">
            <option value="staff">Staff</option>
            <option value="admin">Admin</option>
            <option value="technician">Teknisi</option>
          </select>
        </div>
        <div v-if="form.role === 'technician'">
          <label class="label">Teknisi</label>
          <select v-model="form.technicianId" class="input" required>
            <option value="">Pilih teknisi</option>
            <option v-for="t in technicianOptions" :key="t.id" :value="String(t.id)">{{ t.name }}</option>
          </select>
          <p class="text-xs text-ink-500 mt-1">Satu teknisi hanya bisa punya satu akun login.</p>
        </div>
        <p v-if="errorMsg" class="text-sm text-red-600">{{ errorMsg }}</p>
        <div class="flex justify-end gap-2 pt-2">
          <button type="button" class="btn-secondary" @click="showForm = false"><XMarkIcon class="w-4 h-4" />Batal</button>
          <button type="submit" class="btn-primary"><CheckIcon class="w-4 h-4" />Simpan</button>
        </div>
      </form>
    </AppModal>
  </div>
</template>
