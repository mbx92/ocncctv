<script setup>
import { technicianPayStatus } from '~/utils/technicianPortal.js'

const { data } = await useFetch('/api/me/work')
const summary = computed(() => data.value?.summary || { projectCount: 0, wageTotal: 0, paidTotal: 0, unpaidTotal: 0 })
const projects = computed(() => data.value?.projects || [])
</script>

<template>
  <div class="space-y-4">
    <div>
      <h1 class="text-xl font-bold">Upah</h1>
      <p class="text-xs text-ink-500">Nominal dari pembagian upah proyek, plus status pembayaran dari kas.</p>
    </div>

    <div class="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3">
      <div class="panel p-3 sm:p-4">
        <div class="text-xs font-semibold uppercase tracking-wide text-ink-500">Total upah</div>
        <div class="mt-1 text-xl font-mono font-semibold">{{ formatIDR(summary.wageTotal) }}</div>
      </div>
      <div class="panel p-3 sm:p-4">
        <div class="text-xs font-semibold uppercase tracking-wide text-ink-500">Sudah dibayar</div>
        <div class="mt-1 text-xl font-mono font-semibold text-green-700">{{ formatIDR(summary.paidTotal) }}</div>
      </div>
      <div class="panel p-3 sm:p-4">
        <div class="text-xs font-semibold uppercase tracking-wide text-ink-500">Belum dibayar</div>
        <div class="mt-1 text-xl font-mono font-semibold text-amber-800">{{ formatIDR(summary.unpaidTotal) }}</div>
      </div>
    </div>

    <div class="panel hidden md:block">
      <div class="overflow-x-auto">
        <table class="table-std">
          <thead>
            <tr>
              <th>Proyek</th>
              <th class="text-right">Upah</th>
              <th class="text-right">Dibayar</th>
              <th class="text-right">Sisa</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="p in projects" :key="p.id">
              <td>
                <NuxtLink :to="`/projects/${p.id}`" class="font-medium hover:text-accent-600">{{ p.name }}</NuxtLink>
                <div v-if="p.customerName" class="text-xs text-ink-500">{{ p.customerName }}</div>
              </td>
              <td class="num">{{ formatIDR(p.wageAmount) }}</td>
              <td class="num">{{ formatIDR(p.paidAmount) }}</td>
              <td class="num">{{ formatIDR(p.unpaidAmount) }}</td>
              <td>
                <span class="badge" :class="technicianPayStatus(p).class">{{ technicianPayStatus(p).label }}</span>
              </td>
            </tr>
            <tr v-if="!projects.length">
              <td colspan="5" class="text-center text-ink-500 py-6">Belum ada upah tercatat.</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <div class="md:hidden space-y-2">
      <div v-for="p in projects" :key="p.id" class="panel p-3 space-y-1">
        <NuxtLink :to="`/projects/${p.id}`" class="font-medium hover:text-accent-600">{{ p.name }}</NuxtLink>
        <div class="text-sm font-mono">{{ formatIDR(p.wageAmount) }}</div>
        <div class="text-xs text-ink-500">
          Dibayar {{ formatIDR(p.paidAmount) }} · sisa {{ formatIDR(p.unpaidAmount) }}
        </div>
        <span class="badge" :class="technicianPayStatus(p).class">{{ technicianPayStatus(p).label }}</span>
      </div>
      <p v-if="!projects.length" class="panel p-6 text-center text-sm text-ink-500">Belum ada upah tercatat.</p>
    </div>
  </div>
</template>
