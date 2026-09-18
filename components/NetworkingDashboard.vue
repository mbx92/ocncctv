<script setup>
import { ArrowUpRightIcon, ArrowPathIcon, BanknotesIcon, ChartBarIcon, WalletIcon, ArrowTrendingUpIcon, ClipboardDocumentListIcon, WrenchScrewdriverIcon, CubeIcon, CalendarDaysIcon } from '@heroicons/vue/24/outline'
const props = defineProps({ data: { type: Object, default: null }, month: { type: String, default: '' }, loading: Boolean })
defineEmits(['refresh'])
const metrics = computed(() => [
  { label: 'Penjualan bersih', value: props.data?.pl?.netRevenue, delta: props.data?.vsPrev?.netRevenue, icon: BanknotesIcon, note: `${props.data?.pl?.orderCount ?? 0} transaksi`, tone: 'revenue' },
  { label: 'Laba bersih', value: props.data?.pl?.netProfit, delta: props.data?.vsPrev?.netProfit, icon: ArrowTrendingUpIcon, note: `Margin ${props.data?.pl?.netProfitPercent ?? 0}%`, tone: 'profit' },
  { label: 'Kas keluar', value: props.data?.pl?.totalCashOut, icon: WalletIcon, note: `Perlengkapan ${formatIDR(props.data?.pl?.materialPurchases)}`, tone: 'expense' },
  { label: 'Estimasi kas', value: props.data?.capital?.estimatedCash, icon: ChartBarIcon, note: `Modal kas ${formatIDR(props.data?.capital?.netCapital)}`, extra: `Aset alat ${formatIDR(props.data?.capital?.equipmentAssets)}`, tone: 'cash' }
])
const shortcuts = [
  { to: '/rab', title: 'RAB & penawaran', detail: 'Rencanakan kebutuhan instalasi', icon: ClipboardDocumentListIcon, step: '01' },
  { to: '/projects', title: 'Pekerjaan & instalasi', detail: 'Kelola progres setiap proyek', icon: WrenchScrewdriverIcon, step: '02' },
  { to: '/products', title: 'Perangkat & stok', detail: 'Siapkan kebutuhan lapangan', icon: CubeIcon, step: '03' }
]
function delta(value) { return value == null ? '—' : `${value > 0 ? '+' : ''}${value}%` }
</script>

<template>
  <div class="network-overview" :aria-busy="loading">
    <div class="network-page-heading">
      <div><p class="network-eyebrow">OVERVIEW / OPERASIONAL</p><h1>Dashboard</h1><p>Pekerjaan terarah. Kebutuhan lapangan siap.</p></div>
      <div class="network-page-heading__actions">
        <span class="network-period"><CalendarDaysIcon />{{ month || 'Periode berjalan' }}</span>
        <CatalogSyncBanner variant="network" />
        <RemindersBanner variant="network" />
        <button class="network-icon-button" type="button" aria-label="Muat ulang dashboard" :disabled="loading" @click="$emit('refresh')"><ArrowPathIcon :class="{ 'animate-spin': loading }" /></button>
      </div>
    </div>

    <section class="network-operation" aria-labelledby="operations-heading">
      <div class="network-operation__intro">
        <span class="network-eyebrow">CCTV / NETWORKING / INSTALASI</span>
        <h2 id="operations-heading"><span>Satu ruang untuk</span><span>seluruh pekerjaan.</span></h2>
        <p>Rencanakan penawaran, siapkan perangkat, dan pantau pekerjaan tim Anda.</p>
        <NuxtLink to="/projects" class="network-operation__link">Kelola proyek <ArrowUpRightIcon /></NuxtLink>
      </div>
      <div class="network-operation__summary">
        <p class="network-operation__label"><span class="network-node-dot"></span> RINGKASAN PROYEK</p>
        <div class="network-project-stats">
          <NuxtLink to="/projects"><strong>{{ data ? data.inventory?.productsActive ?? 0 : '—' }}</strong><span>Berjalan</span><small>Dalam pengerjaan</small></NuxtLink>
          <NuxtLink to="/projects"><strong>{{ data ? data.inventory?.productsWaiting ?? 0 : '—' }}</strong><span>Menunggu</span><small>Antrean pekerjaan</small></NuxtLink>
          <NuxtLink to="/projects"><strong>{{ data ? data.inventory?.productsDone ?? 0 : '—' }}</strong><span>Selesai</span><small>Pekerjaan tuntas</small></NuxtLink>
        </div>
        <NuxtLink to="/calendar" class="network-operation__schedule"><CalendarDaysIcon /> Atur jadwal instalasi <ArrowUpRightIcon /></NuxtLink>
      </div>
    </section>

    <nav class="network-workflow" aria-label="Akses cepat operasional">
      <NuxtLink v-for="item in shortcuts" :key="item.to" :to="item.to">
        <span class="network-workflow__icon"><component :is="item.icon" /></span>
        <span class="network-workflow__copy"><strong>{{ item.title }}</strong><small>{{ item.detail }}</small></span>
        <span class="network-workflow__step">{{ item.step }}</span><ArrowUpRightIcon class="network-workflow__arrow" />
      </NuxtLink>
    </nav>

    <div class="network-section-heading"><div><h2>Ringkasan usaha</h2><p>{{ formatDate(data?.range?.from) }} – {{ formatDate(data?.range?.to) }} · Perubahan dibanding periode sama bulan lalu</p></div><NuxtLink to="/reports">Lihat laporan <ArrowUpRightIcon /></NuxtLink></div>
    <div class="network-metrics">
      <article v-for="metric in metrics" :key="metric.label" class="network-metric" :class="`network-metric--${metric.tone}`">
        <div class="network-metric__header"><span>{{ metric.label }}</span><component :is="metric.icon" /></div>
        <strong class="network-metric__value" :class="{ 'text-red-600': Number(metric.value) < 0 }">{{ data ? formatIDR(metric.value) : '—' }}</strong>
        <div class="network-metric__foot">
          <span v-if="'delta' in metric" class="network-delta" :class="metric.delta > 0 ? 'network-delta--up' : metric.delta < 0 ? 'network-delta--down' : ''">{{ delta(metric.delta) }}</span>
          <span>{{ metric.note }}</span>
        </div>
        <p v-if="metric.extra" class="network-metric__extra">{{ metric.extra }}</p>
      </article>
    </div>
  </div>
</template>
