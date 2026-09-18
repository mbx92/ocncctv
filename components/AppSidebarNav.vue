<script setup>
import { ChevronDownIcon } from '@heroicons/vue/24/outline'
import { navigationForRole } from '~/utils/navigation.js'

const props = defineProps({ query: { type: String, default: '' } })
defineEmits(['navigate'])
const route = useRoute()
const authUser = useState('authUser')
const groups = computed(() => navigationForRole(authUser.value?.role))
const { synced: catalogSynced } = useCatalogNotice()
const visibleGroups = computed(() => {
  const query = props.query.trim().toLocaleLowerCase('id')
  return groups.value
    .map((group) => ({
      ...group,
      items: group.items.filter(
        (item) => !query || `${group.label} ${item.label}`.toLocaleLowerCase('id').includes(query)
      )
    }))
    .filter((group) => group.items.length)
})

function isActive(to) {
  if (to === '/') return route.path === '/'
  return route.path === to || route.path.startsWith(`${to}/`)
}

function groupHasActive(group) {
  return group.items.some((item) => isActive(item.to))
}

const expanded = ref({})

watch(
  groups,
  (list) => {
    const next = { ...expanded.value }
    for (const group of list) {
      if (next[group.id] == null) next[group.id] = true
    }
    expanded.value = next
  },
  { immediate: true }
)

watch(
  () => route.path,
  () => {
    for (const group of groups.value) {
      if (groupHasActive(group)) expanded.value[group.id] = true
    }
  },
  { immediate: true }
)

function toggle(id) {
  expanded.value[id] = !expanded.value[id]
}

function linkClass(to) {
  return [
    'app-nav-link flex items-center gap-2.5 pl-4 pr-3 py-2 text-sm border-l-2 transition-colors',
    isActive(to)
      ? 'app-nav-link--active !border-accent-500 !text-white bg-ink-800'
      : 'border-transparent text-ink-300 hover:text-white hover:bg-ink-800'
  ]
}
</script>

<template>
  <nav class="app-nav flex flex-col py-1">
    <section v-for="group in visibleGroups" :key="group.id" class="mb-0.5">
      <button
        type="button"
        class="app-nav-group w-full flex items-center gap-2 px-3 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-ink-500 hover:text-ink-200"
        :aria-expanded="Boolean(query.trim()) || expanded[group.id]"
        @click="toggle(group.id)"
      >
        <span class="flex-1 text-left truncate">{{ group.label }}</span>
        <ChevronDownIcon
          class="w-3.5 h-3.5 shrink-0 transition-transform duration-150"
          :class="query.trim() || expanded[group.id] ? '' : '-rotate-90'"
        />
      </button>
      <div v-show="query.trim() || expanded[group.id]" class="flex flex-col pb-1">
        <NuxtLink v-for="item in group.items" :key="item.to" :to="item.to" :class="linkClass(item.to)" @click="$emit('navigate')">
          <span class="relative shrink-0">
            <component :is="item.icon" class="w-5 h-5" />
            <span
              v-if="item.to === '/catalog'"
              class="app-nav-sync-dot"
              :class="catalogSynced ? 'app-nav-sync-dot--ok' : 'app-nav-sync-dot--pending'"
              :title="catalogSynced ? 'Katalog sudah di-sync' : 'Katalog belum di-sync'"
            />
          </span>
          <span class="truncate flex-1">{{ item.label }}</span>
        </NuxtLink>
      </div>
    </section>
    <p v-if="!visibleGroups.length" class="px-3 py-4 text-sm text-ink-400" role="status">Menu tidak ditemukan.</p>
  </nav>
</template>
