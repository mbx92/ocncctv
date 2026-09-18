<script setup>
import { productStatusClass, productStatusLabel } from '~/utils/productStatus.js'
import { jobTypeClass, jobTypeLabel } from '~/utils/jobType.js'
import { technicianPayStatus } from '~/utils/technicianPortal.js'

const route = useRoute()
const id = route.params.id
const { data, error } = await useFetch(`/api/me/projects/${id}`)
const project = computed(() => data.value?.project)
const pay = computed(() => technicianPayStatus(project.value))
</script>

<template>
  <div class="space-y-4 max-w-2xl">
    <div>
      <NuxtLink to="/projects" class="text-xs text-accent-700 hover:underline">← Proyek saya</NuxtLink>
      <h1 class="text-xl font-bold mt-1">{{ project?.name || 'Proyek' }}</h1>
      <p v-if="project?.customerName" class="text-sm text-ink-500">{{ project.customerName }}</p>
    </div>

    <p v-if="error" class="panel p-4 text-sm text-red-600">
      {{ error.data?.statusMessage || 'Proyek tidak ditemukan atau bukan tugasmu.' }}
    </p>

    <div v-else-if="project" class="space-y-3">
      <div class="flex flex-wrap gap-2">
        <span class="badge" :class="productStatusClass(project.status)">{{ productStatusLabel[project.status] }}</span>
        <span v-if="project.jobType" class="badge" :class="jobTypeClass(project.jobType)">{{ jobTypeLabel[project.jobType] }}</span>
        <span class="badge" :class="pay.class">{{ pay.label }}</span>
      </div>

      <div class="panel p-4 space-y-3">
        <div class="panel-title">Upah kamu</div>
        <div class="grid grid-cols-3 gap-3">
          <div>
            <div class="text-xs text-ink-500">Upah</div>
            <div class="font-mono font-semibold">{{ formatIDR(project.wageAmount) }}</div>
          </div>
          <div>
            <div class="text-xs text-ink-500">Dibayar</div>
            <div class="font-mono font-semibold text-green-700">{{ formatIDR(project.paidAmount) }}</div>
          </div>
          <div>
            <div class="text-xs text-ink-500">Sisa</div>
            <div class="font-mono font-semibold text-amber-800">{{ formatIDR(project.unpaidAmount) }}</div>
          </div>
        </div>
      </div>

      <div class="panel p-4 space-y-2 text-sm">
        <div class="flex justify-between gap-3">
          <span class="text-ink-500">Rencana</span>
          <span class="font-mono">{{ project.plannedStartDate ? formatDate(project.plannedStartDate) : '—' }}</span>
        </div>
        <div class="flex justify-between gap-3">
          <span class="text-ink-500">Mulai</span>
          <span class="font-mono">{{ project.startedAt ? formatDate(project.startedAt) : '—' }}</span>
        </div>
        <div class="flex justify-between gap-3">
          <span class="text-ink-500">Selesai</span>
          <span class="font-mono">{{ project.completedAt ? formatDate(project.completedAt) : '—' }}</span>
        </div>
        <p v-if="project.description" class="text-ink-600 pt-2 border-t border-ink-100">{{ project.description }}</p>
      </div>
    </div>
  </div>
</template>
