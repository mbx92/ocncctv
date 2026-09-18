<script setup>
import { PRODUCT_STATUSES, productStatusClass, productStatusLabel } from '~/utils/productStatus.js'
import { JOB_TYPES, jobTypeClass, jobTypeLabel } from '~/utils/jobType.js'
import { technicianPayStatus } from '~/utils/technicianPortal.js'
import { MagnifyingGlassIcon } from '@heroicons/vue/24/outline'

const { data } = await useFetch('/api/me/work')
const search = ref('')
const statusFilter = ref('')
const jobTypeFilter = ref('')

const filtered = computed(() => {
  const q = search.value.trim().toLowerCase()
  return (data.value?.projects || []).filter((p) => {
    if (statusFilter.value && p.status !== statusFilter.value) return false
    if (jobTypeFilter.value && p.jobType !== jobTypeFilter.value) return false
    if (!q) return true
    return (
      p.name.toLowerCase().includes(q) ||
      (p.customerName || '').toLowerCase().includes(q) ||
      (p.description || '').toLowerCase().includes(q)
    )
  })
})

const { page, pageSize, paged, total, totalPages, rangeStart, rangeEnd, reset } = usePagination(filtered, 10)
watch([search, statusFilter, jobTypeFilter], reset)
</script>

<template>
  <div class="space-y-4">
    <div>
      <h1 class="text-xl font-bold">Proyek saya</h1>
      <p class="text-xs text-ink-500">Hanya proyek yang mencantumkan namamu di upah teknisi.</p>
    </div>

    <div class="flex flex-col sm:flex-row flex-wrap gap-2">
      <div class="relative w-full sm:flex-1 sm:min-w-[12rem] md:max-w-xs">
        <MagnifyingGlassIcon class="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-ink-400 pointer-events-none" />
        <input v-model="search" class="input pl-9 w-full" type="search" placeholder="Cari proyek atau pelanggan…" />
      </div>
      <select v-model="statusFilter" class="input w-full sm:w-40">
        <option value="">Semua status</option>
        <option v-for="s in PRODUCT_STATUSES" :key="s" :value="s">{{ productStatusLabel[s] }}</option>
      </select>
      <select v-model="jobTypeFilter" class="input w-full sm:w-44">
        <option value="">Semua tipe</option>
        <option v-for="t in JOB_TYPES" :key="t" :value="t">{{ jobTypeLabel[t] }}</option>
      </select>
    </div>

    <div class="panel hidden md:block">
      <div class="overflow-x-auto">
        <table class="table-std">
          <thead>
            <tr>
              <th>Proyek</th>
              <th>Status</th>
              <th class="text-right">Upah</th>
              <th>Bayar</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="p in paged" :key="p.id">
              <td>
                <NuxtLink :to="`/projects/${p.id}`" class="font-medium hover:text-accent-600">{{ p.name }}</NuxtLink>
                <div v-if="p.customerName" class="text-xs text-ink-500">{{ p.customerName }}</div>
                <div v-if="p.jobType" class="mt-0.5">
                  <span class="badge" :class="jobTypeClass(p.jobType)">{{ jobTypeLabel[p.jobType] }}</span>
                </div>
              </td>
              <td><span class="badge" :class="productStatusClass(p.status)">{{ productStatusLabel[p.status] }}</span></td>
              <td class="num">{{ formatIDR(p.wageAmount) }}</td>
              <td>
                <span class="badge" :class="technicianPayStatus(p).class">{{ technicianPayStatus(p).label }}</span>
              </td>
            </tr>
            <tr v-if="!total">
              <td colspan="4" class="text-center text-ink-500 py-6">
                {{ search || statusFilter || jobTypeFilter ? 'Tidak ada proyek yang cocok.' : 'Belum ada proyek.' }}
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

    <div class="md:hidden space-y-2">
      <NuxtLink v-for="p in paged" :key="p.id" :to="`/projects/${p.id}`" class="panel p-3 block space-y-1">
        <div class="flex items-start justify-between gap-2">
          <span class="font-medium">{{ p.name }}</span>
          <span class="badge shrink-0" :class="productStatusClass(p.status)">{{ productStatusLabel[p.status] }}</span>
        </div>
        <div v-if="p.customerName" class="text-xs text-ink-500">{{ p.customerName }}</div>
        <div class="text-sm font-mono">{{ formatIDR(p.wageAmount) }}</div>
        <span class="badge" :class="technicianPayStatus(p).class">{{ technicianPayStatus(p).label }}</span>
      </NuxtLink>
      <p v-if="!total" class="panel p-6 text-center text-sm text-ink-500">
        {{ search || statusFilter || jobTypeFilter ? 'Tidak ada proyek yang cocok.' : 'Belum ada proyek.' }}
      </p>
    </div>
  </div>
</template>
