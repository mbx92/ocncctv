<script setup>
import { BellAlertIcon } from '@heroicons/vue/24/outline'

const SESSION_KEY = 'ocn-notif-modal-dismissed'
const ready = ref(false)
const dismissed = ref(false)
const {
  supported,
  granted,
  blocked,
  secure,
  busy,
  lastError,
  enable,
  notifyLocal,
  subscribePush,
  syncPermission,
  refreshItems,
  wanted
} = useReminders()

const authUser = useState('authUser')
const route = useRoute()
const isIos = ref(false)
const isStandalone = ref(false)

const publicPage = computed(() => {
  const path = route.path || ''
  return (
    path === '/login' ||
    path.startsWith('/i/') ||
    path.startsWith('/q/') ||
    path.startsWith('/p/')
  )
})

const canAsk = computed(() => supported.value && secure.value && !blocked.value)

const showPrompt = computed(() => {
  if (!ready.value || !authUser.value || publicPage.value || granted.value || dismissed.value) return false
  if (import.meta.client && localStorage.getItem('ocn-notifications-enabled') === '0') return false
  return true
})

function dismiss() {
  dismissed.value = true
  if (import.meta.client) sessionStorage.setItem(SESSION_KEY, '1')
}

async function onEnable() {
  const ok = await enable()
  if (ok) dismiss()
}

let timer = null

async function tick() {
  if (!authUser.value) return
  syncPermission()
  if (!granted.value || !wanted.value) return
  try {
    await subscribePush({ confirm: sessionStorage.getItem('ocn-push-confirmed') !== '1' })
    sessionStorage.setItem('ocn-push-confirmed', '1')
  } catch {
    /* push opsional di dev tanpa service worker */
  }
  await notifyLocal()
}

function readDismissed() {
  dismissed.value = sessionStorage.getItem(SESSION_KEY) === '1'
}

onMounted(async () => {
  const ua = navigator.userAgent || ''
  isIos.value = /iphone|ipad|ipod/i.test(ua)
  isStandalone.value =
    window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true
  syncPermission()
  readDismissed()
  ready.value = true
  if (authUser.value) {
    await refreshItems().catch(() => [])
    if (granted.value) await tick()
  }
  timer = setInterval(tick, 15 * 60 * 1000)
  document.addEventListener('visibilitychange', onVisible)
})

watch(authUser, (user) => {
  if (!user) return
  syncPermission()
  if (!granted.value) dismissed.value = sessionStorage.getItem(SESSION_KEY) === '1'
})

function onVisible() {
  if (document.visibilityState === 'visible') tick()
}

onUnmounted(() => {
  if (timer) clearInterval(timer)
  document.removeEventListener('visibilitychange', onVisible)
})
</script>

<template>
  <Teleport to="body">
    <div
      v-if="showPrompt"
      class="fixed inset-0 z-[200] flex items-end sm:items-center justify-center p-0 sm:p-4"
    >
      <div class="absolute inset-0 bg-ink-950/50" @click="dismiss"></div>
      <div class="relative panel w-full sm:max-w-md rounded-b-none sm:rounded-panel pb-safe sm:mb-0 shadow-lg">
        <div class="panel-header">
          <span class="panel-title">Izinkan notifikasi</span>
          <button type="button" class="text-ink-400 hover:text-ink-700 text-xl leading-none px-1" @click="dismiss">
            &times;
          </button>
        </div>
        <div class="p-4 space-y-3">
          <div class="flex items-start gap-3">
            <div class="w-10 h-10 rounded-panel bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
              <BellAlertIcon class="w-6 h-6" />
            </div>
            <div class="min-w-0">
              <p class="text-sm font-medium text-ink-900">OCN ingin mengirim pengingat</p>
              <p class="text-sm text-ink-600 mt-1">
                Jadwal kalender dan tagihan jatuh tempo akan muncul di HP, termasuk saat aplikasi tertutup.
              </p>
              <p v-if="!secure" class="text-xs text-amber-800 mt-2">
                Browser memblokir izin di HTTP biasa. Buka lewat
                <span class="font-mono">http://localhost:3000</span>
                atau pakai HTTPS.
              </p>
              <p v-else-if="!supported" class="text-xs text-amber-800 mt-2">
                Browser ini tidak mendukung notifikasi.
              </p>
              <p v-else-if="blocked" class="text-xs text-amber-800 mt-2">
                Izin sudah ditolak. Buka pengaturan situs di browser, lalu izinkan notifikasi untuk OCN.
              </p>
              <p v-else-if="isIos && !isStandalone" class="text-xs text-ink-500 mt-2">
                Di iPhone, pasang OCN ke layar utama dulu (Share → Add to Home Screen).
              </p>
            </div>
          </div>
          <p v-if="lastError" class="text-sm text-red-600">{{ lastError }}</p>
          <div class="flex justify-end gap-2 pt-1">
            <button type="button" class="btn-secondary" @click="dismiss">Nanti</button>
            <button type="button" class="btn-primary" :disabled="busy || !canAsk" @click="onEnable">
              {{ busy ? 'Menunggu izin…' : 'Izinkan' }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>
