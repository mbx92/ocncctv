<script setup>
import { ArrowRightEndOnRectangleIcon } from '@heroicons/vue/24/outline'

definePageMeta({ layout: false })

const { theme } = useTheme()
const form = ref({ username: '', password: '' })
const errorMsg = ref('')
const loading = ref(false)

async function submit() {
  errorMsg.value = ''
  loading.value = true
  try {
    const res = await $fetch('/api/auth/login', { method: 'POST', body: form.value })
    useState('authUser').value = res.user
    await navigateTo('/')
  } catch (e) {
    errorMsg.value = e.data?.statusMessage || 'Gagal login'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="app-login min-h-screen flex items-center justify-center bg-ink-900 p-4 pt-safe pb-safe" :class="{ 'network-login': theme === 'professional' }">
    <section v-if="theme === 'professional'" class="network-login__intro">
      <NetworkingBrand />
      <div><p class="network-eyebrow">RUANG KERJA OCN</p><h1>Menghubungkan perangkat.<br />Menggerakkan usaha.</h1><p>Kelola penawaran, instalasi CCTV, dan pekerjaan networking dalam satu ruang operasional.</p></div>
      <div class="network-login__services"><span>01 / CCTV</span><span>02 / NETWORKING</span><span>03 / INSTALASI</span></div>
    </section>
    <div class="panel network-login__form w-full max-w-sm">
      <div v-if="theme !== 'professional'" class="px-6 pt-6 flex items-center gap-2">
        <img src="/pwa-192x192.png" alt="" class="w-8 h-8 rounded-md object-contain" />
        <span class="font-bold tracking-wide text-lg">OCN</span>
        <span class="text-[10px] uppercase tracking-widest text-ink-400 ml-auto">Workshop</span>
      </div>
      <div v-if="theme === 'professional'" class="network-login__heading"><p class="network-eyebrow">AKSES RUANG KERJA</p><h2>Selamat datang kembali.</h2><p>Masuk dengan akun operasional Anda.</p></div>
      <form class="p-6 space-y-4" @submit.prevent="submit">
        <div>
          <label for="login-username" class="label">Username</label>
          <input id="login-username" v-model="form.username" class="input" required autocomplete="username" />
        </div>
        <div>
          <label for="login-password" class="label">Password</label>
          <input id="login-password" v-model="form.password" type="password" class="input" required autocomplete="current-password" />
        </div>
        <p v-if="errorMsg" class="text-sm text-red-600">{{ errorMsg }}</p>
        <button type="submit" class="btn-primary w-full justify-center" :disabled="loading">
          <ArrowRightEndOnRectangleIcon class="w-4 h-4" />{{ loading ? 'Masuk…' : 'Masuk' }}
        </button>
      </form>
    </div>
  </div>
</template>
