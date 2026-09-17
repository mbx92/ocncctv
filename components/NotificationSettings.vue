<script setup>
const {
  supported,
  granted,
  blocked,
  busy,
  lastError,
  items,
  enable,
  syncPermission,
  refreshItems
} = useReminders()

const isIos = ref(false)
const isStandalone = ref(false)

onMounted(() => {
  const ua = navigator.userAgent || ''
  isIos.value = /iphone|ipad|ipod/i.test(ua)
  isStandalone.value =
    window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true
  syncPermission()
  refreshItems().catch(() => [])
})
</script>

<template>
  <div class="panel p-4 space-y-3">
    <div>
      <div class="panel-title">Pengingat</div>
      <p class="text-xs text-ink-500 mt-1">
        Notifikasi lokal muncul saat aplikasi dibuka. Push muncul di HP meski aplikasi tertutup, setelah izin diberikan
        (di iPhone harus dipasang ke layar utama).
      </p>
    </div>
    <div class="text-sm">
      <span
        class="badge"
        :class="granted ? 'bg-green-100 text-green-800' : blocked ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-800'"
      >
        {{ granted ? 'Izin aktif' : blocked ? 'Izin ditolak' : supported ? 'Belum diizinkan' : 'Tidak didukung' }}
      </span>
      <span v-if="items.length" class="text-xs text-ink-500 ml-2">{{ items.length }} pengingat hari ini</span>
    </div>
    <p v-if="isIos && !isStandalone" class="text-xs text-ink-500">
      Di iPhone: Safari → Share → Add to Home Screen, lalu buka OCN dari ikon itu sebelum mengaktifkan notifikasi.
    </p>
    <p v-if="lastError" class="text-sm text-red-600">{{ lastError }}</p>
    <div>
      <button type="button" class="btn-primary" :disabled="busy || !supported || granted" @click="enable">
        {{ granted ? 'Sudah aktif' : busy ? 'Mengaktifkan…' : 'Aktifkan notifikasi' }}
      </button>
    </div>
  </div>
</template>
