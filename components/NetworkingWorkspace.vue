<script setup>
import { Bars3Icon, ChevronRightIcon, CalendarDaysIcon, ClipboardDocumentListIcon } from '@heroicons/vue/24/outline'
import { navigationForRole } from '~/utils/navigation.js'

const route = useRoute()
const authUser = useState('authUser')
const isTechnician = computed(() => authUser.value?.role === 'technician')
const currentModule = computed(() => {
  for (const group of navigationForRole(authUser.value?.role)) {
    const item = group.items.find((item) =>
      item.to === '/' ? route.path === '/' : route.path === item.to || route.path.startsWith(`${item.to}/`)
    )
    if (item) return { ...item, group: group.label }
  }
  return { label: 'Ruang kerja', group: isTechnician.value ? 'Teknisi' : 'Operasional', to: '/' }
})
const drawer = ref(null)
const menuButton = ref(null)
let previousOverflow = ''
function openMenu() {
  if (drawer.value?.open) return
  previousOverflow = document.body.style.overflow === 'hidden' ? '' : document.body.style.overflow
  drawer.value?.showModal()
  document.body.style.overflow = 'hidden'
}
function closeMenu() {
  if (!drawer.value?.open) return
  drawer.value.close()
}
function restoreScroll() {
  const overflow = ''
  document.body.style.overflow = overflow
  requestAnimationFrame(() => {
    if (!drawer.value?.open) document.body.style.overflow = overflow
  })
  menuButton.value?.focus()
}
watch(() => route.fullPath, closeMenu)
onBeforeUnmount(() => {
  if (drawer.value?.open) document.body.style.overflow = ''
})
async function logout() {
  await $fetch('/api/auth/logout', { method: 'POST' })
  closeMenu()
  authUser.value = null
  await navigateTo('/login')
}
</script>

<template>
  <div class="app-shell network-workspace">
    <a href="#network-content" class="network-skip-link">Lewati ke konten</a>
    <div class="network-desktop-sidebar"><NetworkingSidebar @logout="logout" /></div>
    <dialog ref="drawer" class="network-drawer" aria-label="Menu navigasi" @close="restoreScroll" @click="event => event.target === drawer && closeMenu()" @keydown.esc.prevent="closeMenu">
      <NetworkingSidebar mobile @close="closeMenu" @logout="logout" />
    </dialog>
    <div class="network-workspace__body">
      <header class="network-header">
        <button ref="menuButton" type="button" class="network-icon-button network-mobile-menu" aria-label="Buka menu" @click="openMenu"><Bars3Icon /></button>
        <nav class="network-breadcrumb" aria-label="Lokasi halaman">
          <span>{{ currentModule.group }}</span><ChevronRightIcon aria-hidden="true" />
          <NuxtLink :to="currentModule.to" :aria-current="route.path === currentModule.to ? 'page' : undefined">{{ currentModule.label }}</NuxtLink>
          <template v-if="route.path !== currentModule.to"><ChevronRightIcon aria-hidden="true" /><span>Detail</span></template>
        </nav>
        <div v-if="!isTechnician" class="network-header__actions">
          <NuxtLink to="/calendar" class="network-header-link"><CalendarDaysIcon /><span>Jadwal kerja</span></NuxtLink>
          <NuxtLink to="/rab" class="network-header-link network-header-link--primary"><ClipboardDocumentListIcon /><span>RAB & penawaran</span></NuxtLink>
        </div>
      </header>
      <main id="network-content" tabindex="-1" class="app-main network-content"><slot /></main>
      <footer class="network-footer"><span>OCN / CCTV & Networking</span><span>{{ isTechnician ? 'Portal teknisi' : 'Ruang kerja operasional' }}</span></footer>
    </div>
  </div>
</template>
