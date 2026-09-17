<script setup>
import { BellAlertIcon } from '@heroicons/vue/24/outline'

const { items, refreshItems } = useReminders()

onMounted(() => {
  refreshItems().catch(() => [])
})
</script>

<template>
  <div v-if="items.length" class="panel p-3 sm:p-4 border border-amber-200 bg-amber-50">
    <div class="flex items-start gap-3">
      <BellAlertIcon class="w-5 h-5 mt-0.5 shrink-0 text-amber-700" />
      <div class="min-w-0 flex-1 space-y-1.5">
        <p class="text-sm font-semibold text-ink-900">Pengingat hari ini</p>
        <ul class="space-y-1">
          <li v-for="item in items.slice(0, 6)" :key="item.id">
            <NuxtLink :to="item.url" class="text-sm text-ink-800 hover:underline">
              <span class="font-medium">{{ item.title }}</span>
              <span class="text-ink-500"> — {{ item.body }}</span>
            </NuxtLink>
          </li>
        </ul>
        <p v-if="items.length > 6" class="text-xs text-ink-500">+{{ items.length - 6 }} pengingat lain</p>
      </div>
    </div>
  </div>
</template>
