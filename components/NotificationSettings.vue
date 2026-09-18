<script setup>
const {
  supported,
  granted,
  blocked,
  active,
  busy,
  lastError,
  items,
  enable,
  disable,
  testNotification,
  syncPermission,
  refreshItems
} = useReminders()

const isIos = ref(false)
const isStandalone = ref(false)
const testing = ref(false)

onMounted(() => {
  const ua = navigator.userAgent || ''
  isIos.value = /iphone|ipad|ipod/i.test(ua)
  isStandalone.value =
    window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true
  syncPermission()
  refreshItems().catch(() => [])
})

const toast = useToast()

async function onToggle() {
  if (busy.value) return
  if (active.value) await disable()
  else await enable()
}

async function onTest() {
  testing.value = true
  try {
    const result = await testNotification()
    if (!result?.ok) return
    if (result.via === 'push') {
      toast.success('Notifikasi uji dikirim ke HP. Bisa muncul meski aplikasi tertutup.')
    } else {
      toast.info('Notifikasi uji ditampilkan di perangkat ini. Di production harusnya lewat push, bukan ini.')
    }
  } finally {
    testing.value = false
  }
}

const toggleDisabled = computed(() => busy.value || !supported.value || blocked.value)
</script>

<template>
  <div class="panel p-4 space-y-3">
    <div>
      <div class="panel-title">Pengingat</div>
      <p class="text-xs text-ink-500 mt-1">
        Setelah diaktifkan, pengingat dikirim ke HP meski aplikasi tertutup (setiap hari sekitar pukul 07.00 WIB,
        dan saat jadwal/tagihan baru disimpan). Di iPhone harus dipasang ke layar utama.
      </p>
    </div>

    <div class="flex items-center justify-between gap-3">
      <div class="min-w-0">
        <div class="text-sm font-medium text-ink-900">Notifikasi</div>
        <p class="text-xs text-ink-500 mt-0.5">
          {{
            blocked
              ? 'Izin ditolak di pengaturan situs'
              : active
                ? 'Aktif — pengingat dikirim ke perangkat ini'
                : 'Nonaktif'
          }}
        </p>
      </div>
      <button
        type="button"
        role="switch"
        class="relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        :class="active ? 'bg-accent-500' : 'bg-ink-300'"
        :aria-checked="active"
        :disabled="toggleDisabled"
        @click="onToggle"
      >
        <span
          class="pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transform transition"
          :class="active ? 'translate-x-[1.35rem]' : 'translate-x-0.5'"
        />
      </button>
    </div>

    <div class="text-sm">
      <span
        class="badge"
        :class="active ? 'bg-green-100 text-green-800' : blocked ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-800'"
      >
        {{ active ? 'Izin aktif' : blocked ? 'Izin ditolak' : supported ? 'Belum diizinkan' : 'Tidak didukung' }}
      </span>
      <span v-if="items.length" class="text-xs text-ink-500 ml-2">{{ items.length }} pengingat hari ini</span>
    </div>
    <p v-if="isIos && !isStandalone" class="text-xs text-ink-500">
      Di iPhone: Safari → Share → Add to Home Screen, lalu buka OCN dari ikon itu sebelum mengaktifkan notifikasi.
    </p>
    <p v-if="lastError" class="text-sm text-red-600">{{ lastError }}</p>
    <div>
      <button type="button" class="btn-secondary" :disabled="busy || testing || !active" @click="onTest">
        {{ testing || busy ? 'Mengirim…' : 'Uji notifikasi' }}
      </button>
    </div>
  </div>
</template>
