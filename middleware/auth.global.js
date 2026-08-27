export default defineNuxtRouteMiddleware(async (to) => {
  if (to.path === '/login' || to.path.startsWith('/i/')) return

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
