// State singleton (module-level) sehingga <ConfirmDialog /> yang dipasang sekali
// di app.vue dan pemanggil useConfirm() di halaman manapun berbagi state yang sama.
const state = reactive({
  visible: false,
  title: '',
  message: '',
  confirmText: 'Hapus',
  cancelText: 'Batal',
  variant: 'danger', // danger | primary | warning
  resolve: null
})

export function useConfirm() {
  function confirm(message, opts = {}) {
    const variant = opts.variant || (opts.danger === false ? 'primary' : 'danger')
    state.title = opts.title || (variant === 'danger' ? 'Hapus' : 'Konfirmasi')
    state.message = message
    state.confirmText = opts.confirmText || (variant === 'danger' ? 'Hapus' : 'Ya')
    state.cancelText = opts.cancelText || 'Batal'
    state.variant = variant
    state.visible = true
    return new Promise((resolve) => {
      state.resolve = resolve
    })
  }

  function respond(value) {
    state.visible = false
    state.resolve?.(value)
    state.resolve = null
  }

  return { state, confirm, respond }
}
