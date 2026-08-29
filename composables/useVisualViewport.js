// Lacak visual viewport (area terlihat di atas keyboard) untuk layout mobile/PWA.
export function useVisualViewport() {
  const metrics = reactive({
    height: 0,
    width: 0,
    offsetTop: 0,
    offsetLeft: 0,
    keyboardOpen: false
  })

  function sync() {
    if (!import.meta.client) return
    const vv = window.visualViewport
    if (!vv) {
      metrics.height = window.innerHeight
      metrics.width = window.innerWidth
      metrics.offsetTop = 0
      metrics.offsetLeft = 0
      metrics.keyboardOpen = false
      return
    }
    metrics.height = vv.height
    metrics.width = vv.width
    metrics.offsetTop = vv.offsetTop
    metrics.offsetLeft = vv.offsetLeft
    metrics.keyboardOpen = vv.height < window.innerHeight * 0.85
  }

  const overlayStyle = computed(() => ({
    top: `${metrics.offsetTop}px`,
    left: `${metrics.offsetLeft}px`,
    width: `${metrics.width}px`,
    height: `${metrics.height}px`
  }))

  const panelMaxHeightStyle = computed(() => {
    const h = metrics.height || (import.meta.client ? window.innerHeight : 0)
    return { maxHeight: `${Math.max(Math.round(h * 0.92), 0)}px` }
  })

  onMounted(() => {
    sync()
    window.visualViewport?.addEventListener('resize', sync)
    window.visualViewport?.addEventListener('scroll', sync)
    window.addEventListener('resize', sync)
    window.addEventListener('orientationchange', sync)
  })

  onUnmounted(() => {
    window.visualViewport?.removeEventListener('resize', sync)
    window.visualViewport?.removeEventListener('scroll', sync)
    window.removeEventListener('resize', sync)
    window.removeEventListener('orientationchange', sync)
  })

  return { metrics, overlayStyle, panelMaxHeightStyle, sync }
}
