export function useAnchoredPanel() {
  const open = ref(false)
  const trigger = ref(null)
  const panel = ref(null)
  const panelStyle = ref({})

  function place() {
    if (!open.value || !trigger.value || !import.meta.client) return
    const rect = trigger.value.getBoundingClientRect()
    const margin = 12
    const vw = window.innerWidth
    const vh = window.innerHeight
    const width = Math.min(352, vw - margin * 2)
    let left = rect.right - width
    left = Math.min(Math.max(left, margin), vw - margin - width)
    const panelH = panel.value?.offsetHeight || Math.min(320, vh - margin * 2)
    let top = rect.bottom + 8
    if (top + panelH > vh - margin && rect.top - 8 - panelH >= margin) {
      top = rect.top - 8 - panelH
    } else {
      top = Math.min(top, Math.max(margin, vh - margin - panelH))
    }
    panelStyle.value = {
      position: 'fixed',
      top: `${Math.round(top)}px`,
      left: `${Math.round(left)}px`,
      width: `${Math.round(width)}px`,
      maxHeight: `${Math.round(vh - margin * 2)}px`,
      zIndex: 80
    }
  }

  function close() {
    open.value = false
  }

  function toggle() {
    open.value = !open.value
  }

  function onDocPointer(e) {
    if (!open.value) return
    const t = e.target
    if (trigger.value?.contains(t) || panel.value?.contains(t)) return
    close()
  }

  watch(open, async (v) => {
    if (!v) return
    await nextTick()
    place()
    await nextTick()
    place()
  })

  onMounted(() => {
    document.addEventListener('pointerdown', onDocPointer)
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
  })
  onUnmounted(() => {
    document.removeEventListener('pointerdown', onDocPointer)
    window.removeEventListener('resize', place)
    window.removeEventListener('scroll', place, true)
  })

  return { open, trigger, panel, panelStyle, toggle, close, place }
}
