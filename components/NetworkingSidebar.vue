<script setup>
import { MagnifyingGlassIcon, XMarkIcon, ArrowRightStartOnRectangleIcon, SwatchIcon } from '@heroicons/vue/24/outline'
defineProps({ mobile: { type: Boolean, default: false } })
defineEmits(['close', 'logout'])
const authUser = useState('authUser')
const query = ref('')
</script>

<template>
  <aside class="network-sidebar">
    <div class="network-sidebar__brand">
      <NuxtLink to="/" aria-label="OCN Networking — Dashboard" @click="$emit('close')"><NetworkingBrand /></NuxtLink>
      <button v-if="mobile" type="button" class="network-icon-button" aria-label="Tutup menu" @click="$emit('close')"><XMarkIcon /></button>
    </div>
    <div class="network-workspace-label"><span></span> Ruang operasional</div>
    <label class="network-menu-search">
      <MagnifyingGlassIcon aria-hidden="true" />
      <input v-model="query" type="search" placeholder="Cari menu…" aria-label="Cari menu navigasi" />
    </label>
    <div class="network-sidebar__nav scrollbar-sidebar"><AppSidebarNav :query="query" @navigate="$emit('close')" /></div>
    <div class="network-sidebar__footer">
      <NuxtLink to="/settings?tab=tampilan" class="network-theme-link" @click="$emit('close')"><SwatchIcon /> Tampilan ruang kerja</NuxtLink>
      <div v-if="authUser" class="network-account">
        <span class="network-avatar">{{ authUser.username?.slice(0, 2).toUpperCase() }}</span>
        <div><strong>{{ authUser.username }}</strong><small>{{ authUser.role === 'admin' ? 'Administrator' : 'Staf operasional' }}</small></div>
        <button type="button" class="network-icon-button" aria-label="Keluar dari akun" @click="$emit('logout')"><ArrowRightStartOnRectangleIcon /></button>
      </div>
    </div>
  </aside>
</template>
