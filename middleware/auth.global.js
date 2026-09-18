const PUBLIC_PATHS = new Set(['/login', '/manifest.webmanifest', '/sw.js', '/dev-sw.js'])

function technicianAllowed(to) {
  const path = to.path || ''
  if (path === '/' || path === '/wages') return true
  if (path === '/projects' || path.startsWith('/projects/')) return true
  if (path === '/settings') return String(to.query.tab || 'tampilan') === 'tampilan'
  return false
}

export default defineNuxtRouteMiddleware(async (to) => {
  if (
    PUBLIC_PATHS.has(to.path) ||
    to.path.startsWith('/i/') ||
    to.path.startsWith('/q/') ||
    to.path.startsWith('/p/') ||
    to.path.startsWith('/workbox-') ||
    to.path === '/sw-push.js'
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

  if (authUser.value.role === 'technician') {
    if (to.path === '/settings' && String(to.query.tab || '') !== 'tampilan') {
      return navigateTo({ path: '/settings', query: { tab: 'tampilan' } })
    }
    if (!technicianAllowed(to)) return navigateTo('/')
    return
  }

  if (to.path === '/wages') return navigateTo('/')

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
