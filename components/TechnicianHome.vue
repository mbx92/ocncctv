<script setup>
import { ArrowPathIcon } from '@heroicons/vue/24/outline'
import { productStatusClass, productStatusLabel } from '~/utils/productStatus.js'
import { jobTypeClass, jobTypeLabel } from '~/utils/jobType.js'
import { technicianPayStatus } from '~/utils/technicianPortal.js'

const { data, refresh, status } = await useFetch('/api/me/work')
const summary = computed(() => data.value?.summary || { projectCount: 0, wageTotal: 0, paidTotal: 0, unpaidTotal: 0 })
const projects = computed(() => (data.value?.projects || []).slice(0, 8))
</script>

<template>
  <div class="space-y-4">
    <div class="flex items-center justify-between gap-2">
      <div>
        <h1 class="text-xl font-bold">Halo{{ data?.technician?.name ? `, ${data.technician.name}` : '' }}</h1>
        <p class="text-xs text-ink-500">Proyek dan upah yang tercatat untuk kamu.</p>
      </div>
      <button class="btn-secondary" :disabled="status === 'pending'" @click="refresh()">
        <ArrowPathIcon class="w-4 h-4" />Muat ulang
      </button>
    </div>

    <div class="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
      <div class="panel p-3 sm:p-4">
        <div class="text-xs font-semibold uppercase tracking-wide text-ink-500">Proyek</div>
        <div class="mt-1 text-lg sm:text-2xl font-mono font-semibold">{{ summary.projectCount }}</div>
      </div>
      <div class="panel p-3 sm:p-4">
        <div class="text-xs font-semibold uppercase tracking-wide text-ink-500">Total upah</div>
        <div class="mt-1 text-lg sm:text-2xl font-mono font-semibold text-teal-700">{{ formatIDR(summary.wageTotal) }}</div>
      </div>
      <div class="panel p-3 sm:p-4">
        <div class="text-xs font-semibold uppercase tracking-wide text-ink-500">Sudah dibayar</div>
        <div class="mt-1 text-lg sm:text-2xl font-mono font-semibold text-green-700">{{ formatIDR(summary.paidTotal) }}</div>
      </div>
      <div class="panel p-3 sm:p-4">
        <div class="text-xs font-semibold uppercase tracking-wide text-ink-500">Belum dibayar</div>
        <div class="mt-1 text-lg sm:text-2xl font-mono font-semibold text-amber-800">{{ formatIDR(summary.unpaidTotal) }}</div>
      </div>
    </div>

    <div class="panel">
      <div class="panel-header">
        <span class="panel-title">Proyek saya</span>
        <NuxtLink to="/projects" class="text-xs text-accent-700 hover:underline">Lihat semua</NuxtLink>
      </div>
      <div class="divide-y divide-ink-100">
        <NuxtLink
          v-for="p in projects"
          :key="p.id"
          :to="`/projects/${p.id}`"
          class="flex items-start justify-between gap-3 px-4 py-3 hover:bg-ink-50"
        >
          <div class="min-w-0">
            <div class="font-medium text-ink-900 truncate">{{ p.name }}</div>
            <div class="text-xs text-ink-500 mt-0.5">
              <span v-if="p.customerName">{{ p.customerName }} · </span>
              <span class="badge" :class="productStatusClass(p.status)">{{ productStatusLabel[p.status] }}</span>
              <span v-if="p.jobType" class="badge ml-1" :class="jobTypeClass(p.jobType)">{{ jobTypeLabel[p.jobType] }}</span>
            </div>
          </div>
          <div class="text-right shrink-0">
            <div class="font-mono text-sm">{{ formatIDR(p.wageAmount) }}</div>
            <span class="badge text-[10px]" :class="technicianPayStatus(p).class">{{ technicianPayStatus(p).label }}</span>
          </div>
        </NuxtLink>
        <p v-if="!projects.length" class="px-4 py-8 text-center text-sm text-ink-500">
          Belum ada proyek yang mencantumkan namamu di upah.
        </p>
      </div>
    </div>

    <div>
      <NuxtLink to="/wages" class="btn-secondary">Lihat rincian upah</NuxtLink>
    </div>
  </div>
</template>
