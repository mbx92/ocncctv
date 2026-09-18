<script setup>
const isTechnician = computed(() => useState('authUser').value?.role === 'technician')
</script>

<template>
  <TechnicianProjectDetail v-if="isTechnician" />
  <ProjectWorkspace v-else />
</template>
