<script setup>
import { MagnifyingGlassIcon } from '@heroicons/vue/24/outline'

const props = defineProps({
  projects: { type: Array, default: () => [] },
  companyName: { type: String, default: '' },
  syncing: { type: Boolean, default: false }
})
const emit = defineEmits(['close', 'sync'])

const search = ref('')
const page = ref(1)
const pageSize = ref(30)
const selected = ref(new Set())
const searchEl = ref(null)

watch(
  () => props.projects,
  (list) => {
    selected.value = new Set((list || []).map((p) => p.erpProjectId))
  },
  { immediate: true }
)

const filtered = computed(() => {
  const q = search.value.trim().toLowerCase()
  return (props.projects || []).filter((p) => {
    if (!q) return true
    const hay = [p.name, p.customerName, p.erpProjectId].filter(Boolean).join(' ').toLowerCase()
    return hay.includes(q)
  })
})

const total = computed(() => filtered.value.length)
const totalPages = computed(() => Math.max(1, Math.ceil(total.value / pageSize.value)))
const rangeStart = computed(() => (total.value ? (page.value - 1) * pageSize.value + 1 : 0))
const rangeEnd = computed(() => Math.min(page.value * pageSize.value, total.value))
const paged = computed(() => {
  const start = (page.value - 1) * pageSize.value
  return filtered.value.slice(start, start + pageSize.value)
})
const selectedCount = computed(() => selected.value.size)
const allFilteredSelected = computed(
  () => filtered.value.length > 0 && filtered.value.every((p) => selected.value.has(p.erpProjectId))
)
const pageAllSelected = computed(
  () => paged.value.length > 0 && paged.value.every((p) => selected.value.has(p.erpProjectId))
)
const newCount = computed(() => props.projects.filter((p) => p.syncAction === 'new').length)
const updateCount = computed(() => props.projects.filter((p) => p.syncAction === 'update').length)

watch([search, pageSize], () => {
  page.value = 1
})

onMounted(() => {
  nextTick(() => searchEl.value?.focus())
})

function isSelected(id) {
  return selected.value.has(id)
}

function toggle(project) {
  const next = new Set(selected.value)
  if (next.has(project.erpProjectId)) next.delete(project.erpProjectId)
  else next.add(project.erpProjectId)
  selected.value = next
}

function togglePage() {
  const next = new Set(selected.value)
  if (pageAllSelected.value) {
    for (const project of paged.value) next.delete(project.erpProjectId)
  } else {
    for (const project of paged.value) next.add(project.erpProjectId)
  }
  selected.value = next
}

function toggleAllFiltered() {
  const next = new Set(selected.value)
  if (allFilteredSelected.value) {
    for (const project of filtered.value) next.delete(project.erpProjectId)
  } else {
    for (const project of filtered.value) next.add(project.erpProjectId)
  }
  selected.value = next
}

function clearSelected() {
  selected.value = new Set()
}

function confirmSync() {
  if (!selectedCount.value || props.syncing) return
  emit('sync', [...selected.value])
}

function requestClose() {
  if (props.syncing) return
  emit('close')
}
</script>

<template>
  <AppModal title="Pilih proyek untuk sync ERP" size="xl" @close="requestClose">
    <div class="-m-4 flex flex-col max-h-[min(78dvh,40rem)]">
      <div class="p-4 pb-3 space-y-2 shrink-0 border-b border-ink-100">
        <p class="text-xs text-ink-500">
          <span v-if="companyName">{{ companyName }} · </span>
          {{ projects.length }} proyek dari ERP
          <span v-if="newCount || updateCount">
            ({{ newCount }} baru<span v-if="updateCount">, {{ updateCount }} update</span>)
          </span>
          . Centang proyek yang ingin di-sync.
        </p>
        <div>
          <label class="label">Cari</label>
          <div class="relative">
            <MagnifyingGlassIcon class="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-ink-400 pointer-events-none" />
            <input
              ref="searchEl"
              v-model="search"
              class="input pl-9 w-full"
              type="search"
              autocomplete="off"
              placeholder="Nama proyek, pelanggan, atau ID…"
            />
          </div>
        </div>
        <div class="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-ink-600">
          <label class="flex items-center gap-2">
            <input
              type="checkbox"
              class="h-4 w-4 accent-accent-600"
              :checked="allFilteredSelected"
              :disabled="!filtered.length"
              @change="toggleAllFiltered"
            />
            Pilih semua{{ search ? ' hasil filter' : '' }} ({{ filtered.length }})
          </label>
        </div>
      </div>

      <div class="flex-1 overflow-y-auto min-h-0">
        <p v-if="!filtered.length" class="px-4 py-10 text-center text-sm text-ink-500">
          {{ projects.length ? 'Tidak ada proyek yang cocok.' : 'Tidak ada proyek selesai di ERP.' }}
        </p>
        <template v-else>
          <div class="md:hidden divide-y divide-ink-100">
            <label
              v-for="project in paged"
              :key="project.erpProjectId"
              class="flex items-start gap-3 px-4 py-3 active:bg-ink-50"
            >
              <input
                type="checkbox"
                class="mt-1 h-4 w-4 accent-accent-600"
                :checked="isSelected(project.erpProjectId)"
                @change="toggle(project)"
              />
              <div class="min-w-0 flex-1">
                <div class="text-sm font-medium leading-snug break-words">{{ project.name }}</div>
                <div class="text-[11px] text-ink-400 mt-0.5">
                  <span v-if="project.customerName">{{ project.customerName }} · </span>
                  <span v-if="project.completedAt">Selesai {{ formatDate(project.completedAt) }} · </span>
                  {{ project.itemCount }} item · {{ project.wageCount }} upah
                </div>
              </div>
              <span
                class="badge shrink-0 text-[10px]"
                :class="project.syncAction === 'new' ? 'bg-emerald-100 text-emerald-800' : 'bg-sky-100 text-sky-800'"
              >
                {{ project.syncAction === 'new' ? 'Baru' : 'Update' }}
              </span>
            </label>
          </div>
          <div class="hidden md:block overflow-x-auto">
            <table class="table-std">
              <thead>
                <tr>
                  <th class="w-10">
                    <input
                      type="checkbox"
                      class="h-4 w-4 accent-accent-600"
                      :checked="pageAllSelected"
                      @change="togglePage"
                    />
                  </th>
                  <th>Proyek</th>
                  <th>Pelanggan</th>
                  <th>Selesai</th>
                  <th class="text-right">Nilai</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="project in paged"
                  :key="project.erpProjectId"
                  class="cursor-pointer hover:bg-ink-50"
                  :class="isSelected(project.erpProjectId) ? 'bg-accent-50' : ''"
                  @click="toggle(project)"
                >
                  <td @click.stop>
                    <input
                      type="checkbox"
                      class="h-4 w-4 accent-accent-600"
                      :checked="isSelected(project.erpProjectId)"
                      @change="toggle(project)"
                    />
                  </td>
                  <td class="min-w-0">
                    <div class="font-medium">{{ project.name }}</div>
                    <div class="text-[11px] text-ink-400 font-mono">{{ project.erpProjectId }}</div>
                  </td>
                  <td class="text-xs text-ink-600">{{ project.customerName || '—' }}</td>
                  <td class="whitespace-nowrap font-mono text-xs">{{ project.completedAt ? formatDate(project.completedAt) : '—' }}</td>
                  <td class="num font-medium">{{ project.erpTotalValue ? formatIDR(project.erpTotalValue) : '—' }}</td>
                  <td>
                    <span
                      class="badge text-[10px]"
                      :class="project.syncAction === 'new' ? 'bg-emerald-100 text-emerald-800' : 'bg-sky-100 text-sky-800'"
                    >
                      {{ project.syncAction === 'new' ? 'Baru' : 'Update' }}
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </template>
      </div>

      <div class="shrink-0 border-t border-ink-200 bg-white p-3 sm:p-4 space-y-2">
        <AppPagination
          v-if="total"
          v-model:page="page"
          v-model:pageSize="pageSize"
          :total-pages="totalPages"
          :total="total"
          :range-start="rangeStart"
          :range-end="rangeEnd"
          :page-size-options="[30, 50, 100]"
        />
        <div class="flex flex-wrap items-center justify-between gap-2">
          <p class="text-xs text-ink-500">
            {{ selectedCount ? selectedCount + ' proyek dipilih' : 'Belum ada yang dipilih' }}
            <button
              v-if="selectedCount && !syncing"
              type="button"
              class="text-accent-600 hover:underline ml-1"
              @click="clearSelected"
            >
              hapus pilihan
            </button>
          </p>
          <div class="flex gap-2 ml-auto">
            <button type="button" class="btn-secondary" :disabled="syncing" @click="requestClose">Batal</button>
            <button type="button" class="btn-primary" :disabled="!selectedCount || syncing" @click="confirmSync">
              {{ syncing ? 'Sync…' : `Sync ${selectedCount || ''} proyek`.trim() }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </AppModal>
</template>
