const PUBLIC_PATHS = new Set(['/login', '/manifest.webmanifest', '/sw.js', '/dev-sw.js'])

export default defineNuxtRouteMiddleware(async (to) => {
  if (
    PUBLIC_PATHS.has(to.path) ||
    to.path.startsWith('/i/') ||
    to.path.startsWith('/q/') ||
    to.path.startsWith('/p/') ||
    to.path.startsWith('/workbox-')
  ) {
    return
  }

  const authUser = useState('authUser', () => null)
  if (!authUser.value) {
    try {
      authUser.value = await $fetch('/api/auth/me', {
        headers: import.meta.server ? useRequestHeaders(['cookie']) : undefined
      })
    } catch {
      return navigateTo('/login')
    }
  }

  if (to.path === '/users') {
    return navigateTo(
      authUser.value.role === 'admin' ? { path: '/settings', query: { tab: 'user' } } : '/settings'
    )
  }
  if (to.path === '/audit-log') {
    return navigateTo(
      authUser.value.role === 'admin' ? { path: '/settings', query: { tab: 'audit' } } : '/settings'
    )
  }

  const adminOnlyTabs = ['user', 'audit']
  if (to.path === '/settings' && adminOnlyTabs.includes(String(to.query.tab || '')) && authUser.value.role !== 'admin') {
    return navigateTo('/settings')
  }
})
