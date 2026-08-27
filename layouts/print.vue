<template>
  <div class="min-h-screen bg-white text-ink-900">
    <slot />
  </div>
</template>

<style>
@media print {
  @page {
    size: A4;
    margin: 12mm;
  }
}
</style>

