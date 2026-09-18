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
import { OPS_ROLES, USER_ROLES } from '~/utils/roles.js'

export const navigationGroups = [
  {
    id: 'utama',
    label: 'Utama',
    items: [
      { to: '/', label: 'Dashboard', icon: Squares2X2Icon, roles: USER_ROLES },
      { to: '/calendar', label: 'Kalender', icon: CalendarDaysIcon, roles: OPS_ROLES }
    ]
  },
  {
    id: 'pekerjaan',
    label: 'Pekerjaan',
    items: [
      { to: '/rab', label: 'RAB', icon: ClipboardDocumentListIcon, roles: OPS_ROLES },
      { to: '/packages', label: 'Paket', icon: RectangleStackIcon, roles: OPS_ROLES },
      { to: '/projects', label: 'Proyek', technicianLabel: 'Proyek saya', icon: FolderIcon, roles: USER_ROLES },
      { to: '/wages', label: 'Upah', icon: BanknotesIcon, roles: ['technician'] },
      { to: '/sales', label: 'Penjualan', icon: ShoppingCartIcon, roles: OPS_ROLES }
    ]
  },
  {
    id: 'persediaan',
    label: 'Persediaan',
    items: [
      { to: '/products', label: 'Produk', icon: CubeIcon, roles: OPS_ROLES },
      { to: '/materials', label: 'Perlengkapan', icon: CircleStackIcon, roles: OPS_ROLES },
      { to: '/machines', label: 'Peralatan', icon: WrenchScrewdriverIcon, roles: OPS_ROLES },
      { to: '/jasa', label: 'Jasa', icon: QueueListIcon, roles: OPS_ROLES },
      { to: '/catalog', label: 'Katalog Supplier', icon: BuildingStorefrontIcon, roles: OPS_ROLES },
      { to: '/purchases', label: 'Pembelian', icon: TruckIcon, roles: OPS_ROLES }
    ]
  },
  {
    id: 'keuangan',
    label: 'Keuangan',
    items: [
      { to: '/expenses', label: 'Pengeluaran', icon: BanknotesIcon, roles: OPS_ROLES },
      { to: '/capital', label: 'Modal Usaha', icon: WalletIcon, roles: OPS_ROLES },
      { to: '/reports', label: 'Laporan', icon: ChartBarIcon, roles: OPS_ROLES }
    ]
  },
  {
    id: 'sistem',
    label: 'Sistem',
    items: [{ to: '/settings', label: 'Pengaturan', icon: Cog6ToothIcon, roles: USER_ROLES }]
  }
]

export function navigationForRole(role) {
  const current = role || 'staff'
  return navigationGroups
    .map((group) => ({
      ...group,
      items: group.items
        .filter((item) => (item.roles || USER_ROLES).includes(current))
        .map((item) => ({
          ...item,
          label: current === 'technician' && item.technicianLabel ? item.technicianLabel : item.label
        }))
    }))
    .filter((group) => group.items.length)
}
