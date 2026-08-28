<script setup>
import {
  Squares2X2Icon,
  CircleStackIcon,
  WrenchScrewdriverIcon,
  CubeIcon,
  FolderIcon,
  CalendarDaysIcon,
  RectangleStackIcon,
  ClipboardDocumentListIcon,
  QueueListIcon,
  BuildingStorefrontIcon,
  BanknotesIcon,
  ShoppingCartIcon,
  TruckIcon,
  ChartBarIcon,
  WalletIcon,
  Cog6ToothIcon,
  ChevronDownIcon
} from '@heroicons/vue/24/outline'

const route = useRoute()

const groups = [
  {
    id: 'utama',
    label: 'Utama',
    items: [
      { to: '/', label: 'Dashboard', icon: Squares2X2Icon },
      { to: '/calendar', label: 'Kalender', icon: CalendarDaysIcon }
    ]
  },
  {
    id: 'pekerjaan',
    label: 'Pekerjaan',
    items: [
      { to: '/rab', label: 'RAB', icon: ClipboardDocumentListIcon },
      { to: '/packages', label: 'Paket', icon: RectangleStackIcon },
      { to: '/projects', label: 'Proyek', icon: FolderIcon },
      { to: '/sales', label: 'Penjualan', icon: ShoppingCartIcon }
    ]
  },
  {
    id: 'persediaan',
    label: 'Persediaan',
    items: [
      { to: '/products', label: 'Produk', icon: CubeIcon },
      { to: '/materials', label: 'Perlengkapan', icon: CircleStackIcon },
      { to: '/machines', label: 'Peralatan', icon: WrenchScrewdriverIcon },
      { to: '/jasa', label: 'Jasa', icon: QueueListIcon },
      { to: '/catalog', label: 'Katalog Supplier', icon: BuildingStorefrontIcon },
      { to: '/purchases', label: 'Pembelian', icon: TruckIcon }
    ]
  },
  {
    id: 'keuangan',
    label: 'Keuangan',
    items: [
      { to: '/expenses', label: 'Pengeluaran', icon: BanknotesIcon },
      { to: '/capital', label: 'Modal Usaha', icon: WalletIcon },
      { to: '/reports', label: 'Laporan', icon: ChartBarIcon }
    ]
  },
  {
    id: 'sistem',
    label: 'Sistem',
    items: [{ to: '/settings', label: 'Pengaturan', icon: Cog6ToothIcon }]
  }
]

function isActive(to) {
  if (to === '/') return route.path === '/'
  return route.path === to || route.path.startsWith(`${to}/`)
}

function groupHasActive(group) {
  return group.items.some((item) => isActive(item.to))
}

const expanded = ref(Object.fromEntries(groups.map((g) => [g.id, true])))

watch(
  () => route.path,
  () => {
    for (const group of groups) {
      if (groupHasActive(group)) expanded.value[group.id] = true
    }
  },
  { immediate: true }
)

function toggle(id) {
  expanded.value[id] = !expanded.value[id]
}

function linkClass(to) {
  return [
    'flex items-center gap-2.5 pl-4 pr-3 py-2 text-sm border-l-2 transition-colors',
    isActive(to)
      ? '!border-accent-500 !text-white bg-ink-800'
      : 'border-transparent text-ink-300 hover:text-white hover:bg-ink-800'
  ]
}
</script>

<template>
  <nav class="flex flex-col py-1">
    <section v-for="group in groups" :key="group.id" class="mb-0.5">
      <button
        type="button"
        class="w-full flex items-center gap-2 px-3 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-ink-500 hover:text-ink-200"
        @click="toggle(group.id)"
      >
        <span class="flex-1 text-left truncate">{{ group.label }}</span>
        <ChevronDownIcon
          class="w-3.5 h-3.5 shrink-0 transition-transform duration-150"
          :class="expanded[group.id] ? '' : '-rotate-90'"
        />
      </button>
      <div v-show="expanded[group.id]" class="flex flex-col pb-1">
        <NuxtLink v-for="item in group.items" :key="item.to" :to="item.to" :class="linkClass(item.to)">
          <component :is="item.icon" class="w-5 h-5 shrink-0" />
          <span class="truncate">{{ item.label }}</span>
        </NuxtLink>
      </div>
    </section>
  </nav>
</template>
