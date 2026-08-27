<script setup>
const route = useRoute()
await navigateTo(
  { path: `/rab/${route.params.id}`, query: route.query },
  { redirectCode: 301, replace: true }
)
</script>
