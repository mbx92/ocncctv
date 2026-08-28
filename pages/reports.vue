<script setup>
import { CalendarDaysIcon, ArrowPathIcon } from '@heroicons/vue/24/outline'
import { categoryBadgeClass, categoryNameOf } from '~/utils/expenseCategory.js'
import { categoryChartColor, chartPalette } from '~/utils/chartColors.js'

const filters = ref({ dateFrom: monthStartStr(), dateTo: todayStr() })
const query = computed(() => {
  const q = {}
  if (filters.value.dateFrom) q.dateFrom = filters.value.dateFrom
  if (filters.value.dateTo) q.dateTo = filters.value.dateTo
  return q
})

const { data: summary } = await useFetch('/api/reports/summary', { query, watch: [query] })
const { data: byProduct } = await useFetch('/api/reports/products', { query, watch: [query] })
const { data: byExpense, error: expenseError } = await useFetch('/api/reports/expenses', {
  query,
  watch: [query]
})
const { data: monthly } = await useFetch('/api/reports/monthly', { query: { months: 12 } })
const { data: expenseCategories } = await useFetch('/api/expense-categories')

const tabs = [
  { key: 'summary', label: 'Laba Rugi' },
  { key: 'charts', label: 'Grafik' },
  { key: 'products', label: 'Per Proyek' },
  { key: 'expenses', label: 'Pengeluaran' },
  { key: 'monthly', label: 'Tren Bulanan' }
]
const tab = ref('summary')

function setThisMonth() {
  filters.value = { dateFrom: monthStartStr(), dateTo: todayStr() }
}
function setLast30() {
  const d = new Date()
  d.setDate(d.getDate() - 29)
  filters.value = {
    dateFrom: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`,
    dateTo: todayStr()
  }
}
function setThisYear() {
  filters.value = { dateFrom: `${new Date().getFullYear()}-01-01`, dateTo: todayStr() }
}

function expenseCatName(key) {
  return categoryNameOf(expenseCategories.value, key)
}

const expenseEntries = computed(() => byExpense.value?.entries || [])
const expensePager = usePagination(expenseEntries, 10)
watch(query, expensePager.reset, { deep: true })

const productPager = usePagination(computed(() => byProduct.value || []), 10)
watch(query, productPager.reset, { deep: true })

function monthLabel(key) {
  const [y, m] = key.split('-')
  return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString('id-ID', { month: 'short', year: '2-digit' })
}

const monthlyChartLabels = computed(() => (monthly.value || []).map((m) => monthLabel(m.month)))

const monthlyRevenueSeries = computed(() => [
  {
    label: 'Revenue bersih',
    color: chartPalette.revenue,
    data: (monthly.value || []).map((m) => m.netRevenue)
  },
  {
    label: 'Laba kotor',
    color: chartPalette.grossProfit,
    data: (monthly.value || []).map((m) => m.grossProfit)
  }
])

const monthlyProfitSeries = computed(() => [
  {
    label: 'Laba bersih',
    color: (v) => (Number(v) >= 0 ? chartPalette.netProfit : chartPalette.netLoss),
    data: (monthly.value || []).map((m) => m.netProfit)
  }
])

const expenseDonutSegments = computed(() =>
  (byExpense.value?.categories || []).map((c, i) => ({
    label: c.name || expenseCatName(c.category),
    value: c.amount,
    color: categoryChartColor(c.category, i)
  }))
)

const topProjectBars = computed(() =>
  (byProduct.value || []).slice(0, 8).map((r) => ({
    label: r.productName,
    value: r.netMargin,
    color: r.netMargin >= 0 ? chartPalette.netProfit : chartPalette.netLoss
  }))
)

const expenseCategoryBars = computed(() =>
  (byExpense.value?.categories || []).slice(0, 8).map((c, i) => ({
    label: c.name || expenseCatName(c.category),
    value: c.amount,
    color: categoryChartColor(c.category, i)
  }))
)
</script>

<template>
  <div class="space-y-4">
    <h1 class="text-xl font-bold">Laporan</h1>

    <!-- Rentang tanggal -->
    <div class="panel p-3 space-y-2 overflow-hidden">
      <div class="date-range">
        <div class="date-field">
          <label class="label">Dari</label>
          <input v-model="filters.dateFrom" type="date" class="input" />
        </div>
        <div class="date-field">
          <label class="label">Sampai</label>
          <input v-model="filters.dateTo" type="date" class="input" />
        </div>
      </div>
      <div class="flex gap-2 w-full">
        <button class="btn-secondary flex-1" @click="setThisMonth"><CalendarDaysIcon class="w-3.5 h-3.5" />Bulan ini</button>
        <button class="btn-secondary flex-1" @click="setLast30"><ArrowPathIcon class="w-3.5 h-3.5" />30 hari</button>
        <button class="btn-secondary flex-1" @click="setThisYear"><CalendarDaysIcon class="w-4 h-4" />Tahun ini</button>
      </div>
    </div>

    <!-- Tab -->
    <div class="flex gap-1 overflow-x-auto border-b border-ink-200">
      <button
        v-for="t in tabs"
        :key="t.key"
        class="px-3 py-2 text-sm font-medium whitespace-nowrap border-b-2 -mb-px transition-colors"
        :class="tab === t.key ? 'border-accent-500 text-accent-600' : 'border-transparent text-ink-500 hover:text-ink-800'"
        @click="tab = t.key"
      >
        {{ t.label }}
      </button>
    </div>

    <!-- Laba rugi -->
    <div v-if="tab === 'summary'" class="space-y-3">
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
        <div class="panel p-3">
          <div class="text-xs text-ink-500 uppercase font-semibold">Revenue bersih</div>
          <div class="font-mono text-lg sm:text-xl font-semibold text-teal-600">{{ formatIDR(summary?.netRevenue) }}</div>
          <div class="text-xs text-ink-400">{{ formatNumber(summary?.unitsSold) }} unit · {{ summary?.orderCount }} transaksi</div>
        </div>
        <div class="panel p-3">
          <div class="text-xs text-ink-500 uppercase font-semibold">Laba kotor</div>
          <div class="font-mono text-lg sm:text-xl font-semibold">{{ formatIDR(summary?.grossProfit) }}</div>
          <div class="text-xs text-ink-400">{{ summary?.grossProfitPercent }}% dari revenue bersih</div>
        </div>
        <div class="panel p-3">
          <div class="text-xs text-ink-500 uppercase font-semibold">Biaya operasional</div>
          <div class="font-mono text-lg sm:text-xl font-semibold text-red-600">{{ formatIDR(summary?.operatingExpenses) }}</div>
          <div class="text-xs text-ink-400">di luar pembelian material</div>
        </div>
        <div class="panel p-3">
          <div class="text-xs text-ink-500 uppercase font-semibold">Laba bersih</div>
          <div
            class="font-mono text-lg sm:text-xl font-semibold"
            :class="(summary?.netProfit ?? 0) >= 0 ? 'text-green-600' : 'text-red-600'"
          >
            {{ formatIDR(summary?.netProfit) }}
          </div>
          <div class="text-xs text-ink-400">{{ summary?.netProfitPercent }}% dari revenue bersih</div>
        </div>
      </div>

      <div class="panel">
        <div class="panel-header"><span class="panel-title">Rincian Laba Rugi</span></div>
        <table class="table-std">
          <tbody>
            <tr>
              <td>Revenue kotor</td>
              <td class="num">{{ formatIDR(summary?.grossRevenue) }}</td>
            </tr>
            <tr v-if="summary?.discounts">
              <td class="pl-6 text-ink-500">− Diskon</td>
              <td class="num text-red-600">{{ formatIDR(summary.discounts) }}</td>
            </tr>
            <tr class="bg-ink-50 font-medium">
              <td>Revenue bersih</td>
              <td class="num text-teal-600">{{ formatIDR(summary?.netRevenue) }}</td>
            </tr>
            <tr>
              <td class="pl-6 text-ink-500">− Modal barang</td>
              <td class="num text-red-600">{{ formatIDR(summary?.cogs) }}</td>
            </tr>
            <tr class="bg-ink-50 font-medium">
              <td>Laba kotor</td>
              <td class="num">{{ formatIDR(summary?.grossProfit) }}</td>
            </tr>
            <tr>
              <td class="pl-6 text-ink-500">− Biaya operasional</td>
              <td class="num text-red-600">{{ formatIDR(summary?.operatingExpenses) }}</td>
            </tr>
            <tr class="bg-ink-50 font-semibold">
              <td>Laba bersih</td>
              <td class="num text-base" :class="(summary?.netProfit ?? 0) >= 0 ? 'text-green-600' : 'text-red-600'">
                {{ formatIDR(summary?.netProfit) }}
              </td>
            </tr>
          </tbody>
        </table>
        <div class="p-3 space-y-2 border-t border-ink-200 text-xs text-ink-500">
          <p>
            Pembelian perlengkapan periode ini <span class="font-mono">{{ formatIDR(summary?.materialPurchases) }}</span>
            dipotong dari laba dan estimasi kas (bukan HPP kamera).
          </p>
          <p>
            Pembelian peralatan <span class="font-mono">{{ formatIDR(summary?.machinePurchases) }}</span>
            tidak dikurangkan dari laba (belanja aset). Tetap memotong estimasi kas.
          </p>
          <p>
            Total kas keluar periode ini (perlengkapan + operasional + aset):
            <span class="font-mono font-semibold text-ink-700">{{ formatIDR(summary?.totalCashOut) }}</span>
          </p>
        </div>
      </div>

      <div class="panel">
        <div class="panel-header"><span class="panel-title">Grafik laba rugi</span></div>
        <div class="p-4">
          <ReportPlChart
            :net-revenue="summary?.netRevenue"
            :cogs="summary?.cogs"
            :operating-expenses="summary?.operatingExpenses"
            :net-profit="summary?.netProfit"
          />
        </div>
      </div>
    </div>

    <!-- Grafik -->
    <div v-else-if="tab === 'charts'" class="space-y-3">
      <p class="text-xs text-ink-500">
        Grafik pengeluaran & proyek mengikuti rentang tanggal di atas. Tren bulanan = 12 bulan terakhir.
      </p>

      <div class="panel">
        <div class="panel-header"><span class="panel-title">Tren revenue & laba kotor</span></div>
        <div class="p-4">
          <ReportBarChart
            :labels="monthlyChartLabels"
            :series="monthlyRevenueSeries"
            :height="240"
          />
        </div>
      </div>

      <div class="panel">
        <div class="panel-header"><span class="panel-title">Tren laba bersih</span></div>
        <div class="p-4">
          <ReportBarChart
            :labels="monthlyChartLabels"
            :series="monthlyProfitSeries"
            :height="220"
            allow-negative
          />
        </div>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <div class="panel">
          <div class="panel-header">
            <span class="panel-title">Pengeluaran per kategori</span>
            <span class="font-mono text-sm text-red-600">{{ formatIDR(byExpense?.total) }}</span>
          </div>
          <div class="p-4">
            <ReportDonutChart :segments="expenseDonutSegments" />
          </div>
        </div>
        <div class="panel">
          <div class="panel-header"><span class="panel-title">Top proyek (margin bersih)</span></div>
          <div class="p-4">
            <ReportHBarChart :items="topProjectBars" signed />
          </div>
        </div>
      </div>

      <div class="panel">
        <div class="panel-header"><span class="panel-title">Komposisi laba rugi periode</span></div>
        <div class="p-4">
          <ReportPlChart
            :net-revenue="summary?.netRevenue"
            :cogs="summary?.cogs"
            :operating-expenses="summary?.operatingExpenses"
            :net-profit="summary?.netProfit"
          />
        </div>
      </div>
    </div>

    <!-- Per proyek -->
    <div v-else-if="tab === 'products'" class="panel">
      <div class="overflow-x-auto">
        <table class="table-std min-w-[52rem]">
          <thead>
            <tr>
              <th>Proyek</th>
              <th class="text-right">Transaksi</th>
              <th class="text-right">Nilai rata²</th>
              <th class="text-right">Revenue bersih</th>
              <th class="text-right">Modal</th>
              <th class="text-right">Margin bersih</th>
              <th class="text-right">Margin %</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="r in productPager.paged.value" :key="r.productId">
              <td class="font-medium">
                <NuxtLink
                  v-if="r.customOrderId"
                  :to="`/rab/${r.customOrderId}`"
                  class="hover:text-accent-600"
                >{{ r.productName }}</NuxtLink>
                <NuxtLink
                  v-else-if="r.productId"
                  :to="`/projects/${r.productId}`"
                  class="hover:text-accent-600"
                >{{ r.productName }}</NuxtLink>
                <span v-else>{{ r.productName }}</span>
                <div class="text-xs text-ink-400">{{ r.orders }} transaksi · modal {{ formatIDR(r.totalHpp) }}</div>
              </td>
              <td class="num">{{ formatNumber(r.orders) }}</td>
              <td class="num">{{ formatIDR(r.avgSalePrice) }}</td>
              <td class="num">{{ formatIDR(r.netRevenue) }}</td>
              <td class="num">{{ formatIDR(r.totalHpp) }}</td>
              <td class="num" :class="r.netMargin >= 0 ? 'text-green-600' : 'text-red-600'">{{ formatIDR(r.netMargin) }}</td>
              <td class="num" :class="r.netMargin >= 0 ? 'text-green-600' : 'text-red-600'">{{ r.netMarginPercent }}%</td>
            </tr>
            <tr v-if="!productPager.total.value">
              <td colspan="7" class="text-center text-ink-500 py-6">Tidak ada penjualan pada rentang ini.</td>
            </tr>
          </tbody>
        </table>
      </div>
      <AppPagination
        v-model:page="productPager.page.value"
        v-model:pageSize="productPager.pageSize.value"
        :total-pages="productPager.totalPages.value"
        :total="productPager.total.value"
        :range-start="productPager.rangeStart.value"
        :range-end="productPager.rangeEnd.value"
      />
    </div>

    <!-- Pengeluaran per kategori -->
    <div v-else-if="tab === 'expenses'" class="space-y-3">
      <div class="panel min-w-0 overflow-hidden">
        <div class="panel-header">
          <span class="panel-title">Grafik pengeluaran</span>
          <span class="font-mono font-semibold text-red-600">{{ formatIDR(byExpense?.total) }}</span>
        </div>
        <div class="p-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
          <p v-if="expenseError" class="col-span-full text-center text-red-600 py-4 text-sm">
            Gagal memuat laporan pengeluaran. Coba ubah rentang tanggal atau muat ulang.
          </p>
          <template v-else>
            <ReportDonutChart :segments="expenseDonutSegments" />
            <ReportHBarChart :items="expenseCategoryBars" />
          </template>
        </div>
      </div>

      <div class="panel min-w-0 overflow-hidden">
        <div class="panel-header">
          <span class="panel-title">Detail pengeluaran</span>
          <span class="text-xs text-ink-400">{{ byExpense?.entryCount || 0 }} entri</span>
        </div>
        <div class="overflow-x-auto">
          <table class="table-std">
            <thead>
              <tr>
                <th>Tanggal</th>
                <th>Kategori</th>
                <th>Deskripsi</th>
                <th class="text-right">Jumlah</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="e in expensePager.paged.value" :key="e.id">
                <td class="whitespace-nowrap font-mono text-xs">{{ formatDate(e.date) }}</td>
                <td>
                  <span class="badge" :class="categoryBadgeClass(e.category)">{{ e.categoryName || expenseCatName(e.category) }}</span>
                </td>
                <td class="min-w-0 max-w-[14rem]"><div class="truncate" :title="e.description">{{ e.description }}</div></td>
                <td class="num text-red-600">{{ formatIDR(e.amount) }}</td>
              </tr>
              <tr v-if="!expensePager.paged.value.length">
                <td colspan="4" class="text-center text-ink-500 py-6">Tidak ada pengeluaran pada rentang ini.</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div class="p-3 border-t border-ink-100">
          <AppPagination
            v-model:page="expensePager.page.value"
            v-model:pageSize="expensePager.pageSize.value"
            :total-pages="expensePager.totalPages.value"
            :total="expensePager.total.value"
            :range-start="expensePager.rangeStart.value"
            :range-end="expensePager.rangeEnd.value"
          />
        </div>
      </div>
    </div>

    <!-- Tren bulanan -->
    <div v-else-if="tab === 'monthly'" class="space-y-3">
      <p class="text-xs text-ink-500">12 bulan terakhir (tidak mengikuti filter tanggal di atas).</p>

      <div class="panel">
        <div class="panel-header"><span class="panel-title">Grafik bulanan</span></div>
        <div class="p-4 space-y-6">
          <ReportBarChart
            :labels="monthlyChartLabels"
            :series="monthlyRevenueSeries"
            :height="240"
          />
          <ReportBarChart
            :labels="monthlyChartLabels"
            :series="monthlyProfitSeries"
            :height="200"
            allow-negative
          />
        </div>
      </div>

      <div class="panel overflow-x-auto">
        <table class="table-std min-w-[40rem]">
          <thead>
            <tr>
              <th>Bulan</th>
              <th class="text-right">Unit</th>
              <th class="text-right">Revenue bersih</th>
              <th class="text-right">Modal</th>
              <th class="text-right">Operasional</th>
              <th class="text-right">Laba bersih</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="m in monthly" :key="m.month">
              <td class="font-medium whitespace-nowrap">{{ monthLabel(m.month) }}</td>
              <td class="num">{{ formatNumber(m.units) }}</td>
              <td class="num">{{ formatIDR(m.netRevenue) }}</td>
              <td class="num">{{ formatIDR(m.cogs) }}</td>
              <td class="num text-red-600">{{ formatIDR(m.operatingExpenses) }}</td>
              <td class="num" :class="m.netProfit >= 0 ? 'text-green-600' : 'text-red-600'">{{ formatIDR(m.netProfit) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>
