<script setup>
const props = defineProps({
  title: { type: String, default: '' },
  size: { type: String, default: 'md' }, // md | lg | xl
  nested: { type: Boolean, default: false }
})
defineEmits(['close'])

const widthClass = computed(() => {
  if (props.size === 'xl') return 'sm:max-w-5xl'
  if (props.size === 'lg') return 'sm:max-w-3xl'
  return 'sm:max-w-lg'
})
const zClass = computed(() => (props.nested ? 'z-[110]' : 'z-[100]'))
const panelRef = ref(null)
const isMobile = ref(false)
const { metrics, overlayStyle, panelMaxHeightStyle } = useVisualViewport()

// Kunci scroll halaman selama modal terbuka; di PWA keyboard tidak boleh
// menggeser/memperbesar layout di belakang modal.
let prevOverflow = ''
let prevOverscroll = ''
let mobileMq = null

function updateMobile() {
  if (!import.meta.client) return
  isMobile.value = mobileMq?.matches ?? window.innerWidth < 768
}

onMounted(() => {
  if (!import.meta.client) return
  mobileMq = window.matchMedia('(max-width: 767px)')
  updateMobile()
  mobileMq.addEventListener('change', updateMobile)

  if (props.nested) return
  prevOverflow = document.body.style.overflow
  prevOverscroll = document.body.style.overscrollBehavior
  document.body.style.overflow = 'hidden'
  document.body.style.overscrollBehavior = 'none'
})

onUnmounted(() => {
  mobileMq?.removeEventListener('change', updateMobile)

  if (props.nested || !import.meta.client) return
  document.body.style.overflow = prevOverflow
  document.body.style.overscrollBehavior = prevOverscroll
})

const overlayBoxStyle = computed(() => {
  if (isMobile.value) return overlayStyle.value
  return { height: '100dvh', maxHeight: '100dvh' }
})

const panelBoxStyle = computed(() => {
  if (isMobile.value) return panelMaxHeightStyle.value
  return { maxHeight: 'min(92dvh, 100dvh)' }
})

function scrollFieldIntoView(el) {
  const panel = panelRef.value
  if (!panel || !(el instanceof HTMLElement)) return

  const panelRect = panel.getBoundingClientRect()
  const elRect = el.getBoundingClientRect()
  const vv = window.visualViewport
  const visibleTop = vv?.offsetTop ?? 0
  const visibleBottom = vv ? vv.offsetTop + vv.height : window.innerHeight
  const padding = 16

  if (elRect.bottom > visibleBottom - padding) {
    panel.scrollTop += elRect.bottom - visibleBottom + padding
  } else if (elRect.top < panelRect.top + padding) {
    panel.scrollTop -= panelRect.top + padding - elRect.top
  }
}

function onFocusIn(e) {
  const el = e.target
  if (!(el instanceof HTMLElement)) return
  if (!/^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)) return

  // Tunggu keyboard/viewport settle, lalu geser isi modal (bukan halaman).
  requestAnimationFrame(() => {
    scrollFieldIntoView(el)
    setTimeout(() => scrollFieldIntoView(el), 120)
    setTimeout(() => scrollFieldIntoView(el), 320)
  })
}
</script>

<template>
  <Teleport to="body">
    <div
      class="fixed flex items-end sm:items-center justify-center overflow-hidden overscroll-none right-0 bottom-0 sm:inset-0"
      :class="zClass"
      :style="overlayBoxStyle"
    >
      <div class="absolute inset-0 bg-ink-950/50" @click="$emit('close')"></div>
      <div
        ref="panelRef"
        class="relative panel w-full overflow-y-auto overscroll-contain rounded-b-none sm:rounded-panel sm:m-4"
        :class="[widthClass, isMobile && metrics.keyboardOpen ? 'pb-3' : 'pb-safe']"
        :style="panelBoxStyle"
        @focusin="onFocusIn"
      >
        <div class="panel-header sticky top-0 bg-white z-10">
          <span class="panel-title">{{ title }}</span>
          <button class="text-ink-400 hover:text-ink-700 text-xl leading-none px-1" @click="$emit('close')">
            &times;
          </button>
        </div>
        <div class="p-4 modal-body">
          <slot />
        </div>
      </div>
    </div>
  </Teleport>
</template>
