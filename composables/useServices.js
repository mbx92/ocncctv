// Master jasa / tarif kerja. Dipakai halaman Jasa dan picker RAB.
// Sinkron lewat key useFetch yang sama — jangan di-await.
export function useServices() {
  const { data, refresh, pending, error } = useFetch('/api/services', {
    key: 'services',
    default: () => []
  })

  const list = computed(() => data.value || [])

  async function create(body) {
    const row = await $fetch('/api/services', { method: 'POST', body })
    await refresh()
    return row
  }

  async function update(id, body) {
    const row = await $fetch(`/api/services/${id}`, { method: 'PUT', body })
    await refresh()
    return row
  }

  async function remove(id) {
    await $fetch(`/api/services/${id}`, { method: 'DELETE' })
    await refresh()
  }

  return { services: data, list, refresh, pending, error, create, update, remove }
}
