<script setup>
import { CheckIcon, ArrowPathIcon } from '@heroicons/vue/24/outline'
import { suggestedSalePrice } from '~/utils/rab.js'

const { data: settings, refresh } = await useFetch('/api/settings')
const form = ref({
  invoiceBusinessName: 'OCN',
  invoiceAddress: '',
  invoicePhone: '',
  invoiceFooter: '',
  rabFooter: '',
  invoiceShareTtlDays: 7,
  defaultMarginPercent: 40,
  salePriceRounding: 500,
  ...settings.value
})
const savedMsg = ref('')
const isAdmin = computed(() => useState('authUser').value?.role === 'admin')

const tabs = computed(() => {
  const list = [
    { id: 'umum', label: 'Umum' },
    { id: 'integrasi', label: 'Integrasi' },
    { id: 'invoice', label: 'Dokumen' },
    { id: 'hpp', label: 'Harga' }
  ]
  if (isAdmin.value) {
    list.push({ id: 'user', label: 'User' }, { id: 'audit', label: 'Log aktivitas' })
  }
  return list
})
const formTabs = new Set(['umum', 'invoice', 'hpp'])
const route = useRoute()
const router = useRouter()
const tab = computed({
  get() {
    const id = String(route.query.tab || 'umum')
    return tabs.value.some((t) => t.id === id) ? id : 'umum'
  },
  set(id) {
    router.replace({ query: { ...route.query, tab: id } })
  }
})

async function save() {
  await $fetch('/api/settings', { method: 'PUT', body: form.value })
  await refresh()
  Object.assign(form.value, settings.value)
  savedMsg.value = 'Pengaturan tersimpan.'
  setTimeout(() => (savedMsg.value = ''), 3000)
}

const PRICE_ROUNDING_OPTIONS = [
  { value: 0, label: 'Tidak dibulatkan' },
  { value: 100, label: 'Rp 100' },
  { value: 500, label: 'Rp 500' },
  { value: 1000, label: 'Rp 1.000' },
  { value: 5000, label: 'Rp 5.000' }
]
const previewCost = 100000
const previewSale = computed(() =>
  suggestedSalePrice(previewCost, form.value.defaultMarginPercent, form.value.salePriceRounding)
)

const { data: minioStatus, refresh: refreshMinio, status: minioFetchStatus } = await useFetch(
  '/api/system/minio-status'
)
const minioStatusLabel = computed(() => {
  if (!minioStatus.value) return 'Memeriksa…'
  if (!minioStatus.value.reachable) return 'Tidak terhubung'
  if (!minioStatus.value.bucketExists) return 'Terhubung — bucket belum dibuat (otomatis saat upload pertama)'
  return 'Terhubung & siap'
})
function formatBytes(bytes) {
  const n = Number(bytes) || 0
  if (n >= 1024 * 1024) return (n / 1024 / 1024).toFixed(1) + ' MB'
  if (n >= 1024) return (n / 1024).toFixed(0) + ' KB'
  return n + ' B'
}

const erpForm = ref({
  erpSyncBaseUrl: settings.value?.erpSyncBaseUrl || '',
  erpSyncApiKey: ''
})
const erpSaving = ref(false)
const erpSyncing = ref(false)
const erpTesting = ref(false)
const erpMsg = ref('')
const erpTest = ref(null)

watch(
  () => settings.value?.erpSyncBaseUrl,
  (url) => {
    if (url != null) erpForm.value.erpSyncBaseUrl = url || ''
  }
)

async function saveErp() {
  if (!isAdmin.value) return
  erpSaving.value = true
  erpMsg.value = ''
  try {
    const saved = await $fetch('/api/settings', {
      method: 'PUT',
      body: {
        ...form.value,
        erpSyncBaseUrl: erpForm.value.erpSyncBaseUrl,
        erpSyncApiKey: erpForm.value.erpSyncApiKey
      }
    })
    await refresh()
    Object.assign(form.value, settings.value)
    erpForm.value.erpSyncApiKey = ''
    erpMsg.value = saved.erpSyncApiKeySet ? 'Integrasi ERP tersimpan.' : 'URL tersimpan. Isi API key untuk sync.'
    setTimeout(() => (erpMsg.value = ''), 3000)
    return true
  } catch (e) {
    useToast().error(e.data?.statusMessage || 'Gagal menyimpan integrasi ERP')
    return false
  } finally {
    erpSaving.value = false
  }
}

async function testErp() {
  if (erpTesting.value) return
  erpTesting.value = true
  erpTest.value = null
  try {
    erpTest.value = await $fetch('/api/projects/test-erp', {
      method: 'POST',
      body: {
        erpSyncBaseUrl: erpForm.value.erpSyncBaseUrl,
        erpSyncApiKey: erpForm.value.erpSyncApiKey
      },
      timeout: 30000
    })
    useToast().success('Koneksi ERP berhasil.')
  } catch (e) {
    erpTest.value = { ok: false, error: e.data?.statusMessage || 'Gagal menghubungi ERP' }
    useToast().error(erpTest.value.error)
  } finally {
    erpTesting.value = false
  }
}

async function syncErpProjects() {
  if (erpSyncing.value) return
  erpSyncing.value = true
  try {
    if (erpForm.value.erpSyncBaseUrl !== (settings.value?.erpSyncBaseUrl || '') || erpForm.value.erpSyncApiKey) {
      const saved = await saveErp()
      if (!saved) return
    }
    const data = await $fetch('/api/projects/sync-erp', { method: 'POST', timeout: 120000 })
    await refresh()
    useToast().success(data.message || 'Sync ERP selesai.')
  } catch (e) {
    useToast().error(e.data?.statusMessage || 'Gagal sync proyek dari ERP')
  } finally {
    erpSyncing.value = false
  }
}
</script>

<template>
  <div class="space-y-4" :class="tab === 'user' || tab === 'audit' ? 'max-w-5xl' : 'max-w-3xl'">
    <h1 class="text-xl font-bold">Pengaturan</h1>
    <p v-if="!isAdmin" class="text-xs text-ink-500">Read-only — hanya admin yang bisa mengubah pengaturan.</p>

    <div class="flex gap-1 overflow-x-auto border-b border-ink-200 -mb-px">
      <button
        v-for="t in tabs"
        :key="t.id"
        type="button"
        class="shrink-0 px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors"
        :class="tab === t.id ? 'border-accent-500 text-accent-700' : 'border-transparent text-ink-500 hover:text-ink-800'"
        @click="tab = t.id"
      >
        {{ t.label }}
      </button>
    </div>

    <form v-if="formTabs.has(tab)" class="panel p-4 space-y-4" @submit.prevent="save">
      <template v-if="tab === 'umum'">
        <p class="text-xs text-ink-500">Identitas usaha dipakai di invoice dan tampilan internal.</p>
        <div>
          <label class="label">Nama usaha</label>
          <input v-model="form.invoiceBusinessName" class="input" :disabled="!isAdmin" placeholder="OCN" />
        </div>
        <div>
          <label class="label">Alamat</label>
          <textarea v-model="form.invoiceAddress" class="input min-h-[4.5rem]" :disabled="!isAdmin" placeholder="opsional" />
        </div>
        <div>
          <label class="label">Telepon / WhatsApp</label>
          <input v-model="form.invoicePhone" class="input" :disabled="!isAdmin" placeholder="opsional" />
        </div>
      </template>

      <template v-else-if="tab === 'invoice'">
        <p class="text-xs text-ink-500">
          Kop memakai nama, alamat, dan telepon dari tab Umum. Catatan kaki bisa berbeda untuk invoice dan penawaran RAB.
        </p>
        <div>
          <label class="label">Catatan kaki invoice</label>
          <textarea
            v-model="form.invoiceFooter"
            class="input min-h-[7rem]"
            rows="5"
            :disabled="!isAdmin"
            placeholder="Terima kasih telah berbelanja.&#10;BCA 1234567890 a.n. OCN"
          ></textarea>
          <p class="text-xs text-ink-500 mt-1">Tampil di bawah total invoice. Bisa beberapa baris — rekening, QRIS, atau syarat pembayaran.</p>
        </div>
        <div>
          <label class="label">Catatan kaki penawaran RAB</label>
          <textarea
            v-model="form.rabFooter"
            class="input min-h-[7rem]"
            rows="5"
            :disabled="!isAdmin"
            placeholder="Terima kasih atas kepercayaannya.&#10;Penawaran berlaku 14 hari."
          ></textarea>
          <p class="text-xs text-ink-500 mt-1">Tampil di bawah total penawaran RAB. Terpisah dari catatan invoice.</p>
        </div>
        <div>
          <label class="label">Umur tautan bagikan (hari)</label>
          <input
            v-model.number="form.invoiceShareTtlDays"
            type="number"
            min="1"
            max="365"
            class="input-num"
            :disabled="!isAdmin"
          />
          <p class="text-xs text-ink-500 mt-1">
            Tautan publik invoice dan penawaran RAB dari tombol Bagikan berlaku selama ini (1–365 hari). Tautan yang sudah dibuat tidak berubah umurnya.
          </p>
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div class="rounded-panel border border-ink-200 bg-ink-50 p-3 text-sm space-y-1">
            <div class="text-[10px] uppercase font-semibold tracking-wide text-ink-400">Pratinjau invoice</div>
            <div class="font-semibold">{{ form.invoiceBusinessName || 'OCN' }}</div>
            <div v-if="form.invoiceAddress" class="text-ink-600 whitespace-pre-line text-xs">{{ form.invoiceAddress }}</div>
            <div v-if="form.invoicePhone" class="text-ink-600 text-xs">{{ form.invoicePhone }}</div>
            <div class="text-ink-500 text-xs pt-2 whitespace-pre-line">{{ form.invoiceFooter || 'Terima kasih telah berbelanja.' }}</div>
          </div>
          <div class="rounded-panel border border-ink-200 bg-ink-50 p-3 text-sm space-y-1">
            <div class="text-[10px] uppercase font-semibold tracking-wide text-ink-400">Pratinjau penawaran RAB</div>
            <div class="font-semibold">{{ form.invoiceBusinessName || 'OCN' }}</div>
            <div v-if="form.invoiceAddress" class="text-ink-600 whitespace-pre-line text-xs">{{ form.invoiceAddress }}</div>
            <div v-if="form.invoicePhone" class="text-ink-600 text-xs">{{ form.invoicePhone }}</div>
            <div class="text-ink-500 text-xs pt-2 whitespace-pre-line">{{ form.rabFooter || form.invoiceFooter || 'Terima kasih atas kepercayaannya.' }}</div>
          </div>
        </div>
      </template>

      <template v-else-if="tab === 'hpp'">
        <p class="text-xs text-ink-500">
          Dipakai saat menambah barang katalog ke RAB: harga jual diisi dari modal + margin, lalu dibulatkan.
        </p>
        <div>
          <label class="label">Target margin default (%)</label>
          <input
            v-model.number="form.defaultMarginPercent"
            type="number"
            min="0"
            max="95"
            class="input-num"
            required
            :disabled="!isAdmin"
          />
          <p class="text-xs text-ink-500 mt-1">Harga jual = modal ÷ (1 − margin). Contoh 40% dari modal Rp 100.000 → Rp 166.667 sebelum pembulatan.</p>
        </div>
        <div>
          <label class="label">Pembulatan harga jual</label>
          <select v-model.number="form.salePriceRounding" class="input" :disabled="!isAdmin">
            <option v-for="opt in PRICE_ROUNDING_OPTIONS" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
          </select>
          <p class="text-xs text-ink-500 mt-1">Dibulatkan ke atas agar margin tidak turun di bawah target.</p>
        </div>
        <div class="rounded-panel border border-ink-200 bg-ink-50 p-3 text-sm space-y-1">
          <div class="text-[10px] uppercase font-semibold tracking-wide text-ink-400">Contoh</div>
          <div class="flex justify-between gap-2">
            <span class="text-ink-500">Modal</span>
            <span class="font-mono">{{ formatIDR(previewCost) }}</span>
          </div>
          <div class="flex justify-between gap-2">
            <span class="text-ink-500">Harga jual saran</span>
            <span class="font-mono font-semibold">{{ formatIDR(previewSale) }}</span>
          </div>
        </div>
      </template>

      <div v-if="isAdmin" class="flex items-center gap-3 pt-1">
        <button type="submit" class="btn-primary"><CheckIcon class="w-4 h-4" />Simpan</button>
        <span v-if="savedMsg" class="text-sm text-green-600">{{ savedMsg }}</span>
      </div>
    </form>

    <div v-else-if="tab === 'user'">
      <SettingsUsers />
    </div>
    <div v-else-if="tab === 'audit'">
      <SettingsAuditLog />
    </div>
    <div v-else class="space-y-4">
      <div class="panel">
        <div class="panel-header">
          <span class="panel-title">MinIO (file 3D)</span>
          <button class="btn-secondary" :disabled="minioFetchStatus === 'pending'" @click="refreshMinio">
            <ArrowPathIcon class="w-3.5 h-3.5" />Cek ulang
          </button>
        </div>
        <div class="p-4 space-y-3">
          <div class="flex items-center gap-2">
            <span
              class="inline-block w-2.5 h-2.5 rounded-full shrink-0"
              :class="minioStatus?.reachable && minioStatus?.bucketExists ? 'bg-green-500' : minioStatus?.reachable ? 'bg-amber-500' : 'bg-red-500'"
            ></span>
            <span class="text-sm font-medium">{{ minioStatusLabel }}</span>
          </div>
          <dl class="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <div>
              <dt class="text-xs uppercase text-ink-500">Endpoint</dt>
              <dd class="font-mono break-all">{{ minioStatus?.endpoint }}{{ minioStatus?.useSSL ? ' (SSL)' : '' }}</dd>
            </div>
            <div>
              <dt class="text-xs uppercase text-ink-500">Bucket</dt>
              <dd class="font-mono">{{ minioStatus?.bucket }}</dd>
            </div>
            <div>
              <dt class="text-xs uppercase text-ink-500">Latency</dt>
              <dd class="font-mono">{{ minioStatus?.latencyMs ?? '-' }} ms</dd>
            </div>
            <div>
              <dt class="text-xs uppercase text-ink-500">File tersimpan</dt>
              <dd class="font-mono">{{ minioStatus?.fileCount ?? 0 }} file · {{ formatBytes(minioStatus?.totalBytes) }}</dd>
            </div>
          </dl>
          <p v-if="minioStatus?.error" class="text-sm text-red-600">{{ minioStatus.error }}</p>
          <p class="text-xs text-ink-400">Kredensial diatur lewat environment (`MINIO_*`).</p>
        </div>
      </div>

      <div class="panel">
        <div class="panel-header">
          <span class="panel-title">ERP OCN (proyek selesai)</span>
        </div>
        <div class="p-4 space-y-3">
          <p class="text-xs text-ink-500">
            Ambil proyek selesai tahun 2026 dari OC Networks (item, upah, nilai). Status di sini: <strong>Pending</strong> — diproses manual.
          </p>
          <div>
            <label class="label">URL ERP</label>
            <input
              v-model="erpForm.erpSyncBaseUrl"
              class="input"
              :disabled="!isAdmin"
              placeholder="http://localhost:8000"
              autocomplete="off"
            />
          </div>
          <div>
            <label class="label">API key</label>
            <input
              v-model="erpForm.erpSyncApiKey"
              class="input"
              type="password"
              :disabled="!isAdmin"
              :placeholder="settings?.erpSyncApiKeyHint || 'sama dengan OCN_CCTV_API_KEY di ERP'"
              autocomplete="new-password"
            />
            <p class="text-xs text-ink-400 mt-1">
              Key di ERP: `OCN_CCTV_API_KEY`. Usaha: `OCN_CCTV_COMPANY_NAME` (default OC Networks).
            </p>
          </div>
          <p v-if="settings?.erpSyncLastAt" class="text-xs text-ink-400">
            Terakhir sync {{ formatDate(settings.erpSyncLastAt) }}
          </p>
          <div v-if="erpTest" class="rounded-panel border p-3 text-sm space-y-1" :class="erpTest.ok ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'">
            <div class="flex items-center gap-2">
              <span
                class="inline-block w-2.5 h-2.5 rounded-full shrink-0"
                :class="erpTest.ok ? 'bg-green-500' : 'bg-red-500'"
              ></span>
              <span class="font-medium">{{ erpTest.ok ? 'ERP terhubung' : 'ERP tidak terhubung' }}</span>
            </div>
            <template v-if="erpTest.ok">
              <p v-if="erpTest.companyName" class="text-ink-600">Usaha: {{ erpTest.companyName }}</p>
              <p class="text-xs text-ink-500 font-mono">
                Halaman 1: {{ erpTest.pageProjects }} proyek
                <span v-if="erpTest.totalProjects != null"> · total {{ erpTest.totalProjects }}</span>
                · {{ erpTest.latencyMs }} ms
              </p>
            </template>
            <p v-else class="text-red-600 text-xs">{{ erpTest.error }}</p>
          </div>
          <div v-if="isAdmin" class="flex flex-wrap items-center gap-2 pt-1">
            <button type="button" class="btn-secondary" :disabled="erpSaving" @click="saveErp">
              <CheckIcon class="w-4 h-4" />{{ erpSaving ? 'Menyimpan…' : 'Simpan' }}
            </button>
            <button type="button" class="btn-secondary" :disabled="erpTesting || erpSaving" @click="testErp">
              <ArrowPathIcon class="w-4 h-4" :class="erpTesting ? 'animate-spin' : ''" />
              {{ erpTesting ? 'Mengecek…' : 'Test koneksi' }}
            </button>
            <button type="button" class="btn-primary" :disabled="erpSyncing || erpSaving || erpTesting" @click="syncErpProjects">
              <ArrowPathIcon class="w-4 h-4" :class="erpSyncing ? 'animate-spin' : ''" />
              {{ erpSyncing ? 'Sync…' : 'Sync sekarang' }}
            </button>
            <span v-if="erpMsg" class="text-sm text-green-600">{{ erpMsg }}</span>
          </div>
          <p v-else class="text-sm text-ink-500">Integrasi ERP hanya diubah oleh admin.</p>
        </div>
      </div>
    </div>
  </div>
</template>
