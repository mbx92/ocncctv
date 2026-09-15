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
  Cog6ToothIcon
} from '@heroicons/vue/24/outline'

export const navigationGroups = [
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

