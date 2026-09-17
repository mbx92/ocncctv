<script setup>
const { theme } = useTheme()
useHead(() => ({
  htmlAttrs: { 'data-theme': theme.value },
  meta: [{ name: 'theme-color', content: theme.value === 'professional' ? '#f3f5f7' : '#1f2429' }]
}))

// Pastikan <link rel="manifest"> selalu ada di SSR HTML.
// Tanpa ini, install HP sering jadi shortcut browser (bukan standalone).
useHead({
  link: [{ rel: 'manifest', href: '/manifest.webmanifest' }]
})
</script>

<template>
  <NuxtPwaManifest />
  <NuxtLayout>
    <NuxtPage />
  </NuxtLayout>
  <ConfirmDialog />
  <ToastContainer />
  <ClientOnly>
    <PwaPrompt />
    <NotificationPrompt />
  </ClientOnly>
</template>
