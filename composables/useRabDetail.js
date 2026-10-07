import { computed, ref, toValue, watch } from 'vue'
import { rabIsLocked } from '~/utils/rab.js'

// Deteksi jenis lampiran RAB: berkas 3D, gambar, atau file biasa.
const MODEL_RE = /\.(stl|obj|3mf|glb|gltf)$/i
const IMAGE_RE = /\.(png|jpe?g|webp)$/i

// Logika halaman detail RAB (data, baris penawaran, aksi status, lampiran).
// Dipisah dari komponen agar template hanya menangani tampilan.
// Catatan: komposabel ini sinkron — jangan di-await di setup, agar konteks
// Nuxt (useFetch) tetap valid.
export function useRabDetail(id) {
  const orderId = computed(() => toValue(id))

  const { data: order, refresh } = useFetch(() => `/api/custom-orders/${orderId.value}`)
  const { data: settings } = useFetch('/api/settings')

  // --- Status & izin edit ---
  const locked = computed(() => rabIsLocked(order.value?.status))
  const canEdit = computed(() => Boolean(order.value) && !locked.value)
  const files = computed(() => order.value?.files || [])
  const marginPercent = computed(() => settings.value?.defaultMarginPercent ?? 40)
  const priceRounding = computed(() => settings.value?.salePriceRounding ?? 500)

  // --- Edit data RAB ---
  const editing = ref(false)
  const form = ref({})
  const saving = ref(false)
  const errorMsg = ref('')

  function startEdit() {
    const o = order.value
    form.value = {
      date: o.date,
      customerName: o.customerName,
      title: o.title,
      notes: o.notes || '',
      jobType: o.jobType || 'install'
    }
    errorMsg.value = ''
    editing.value = true
  }

  async function saveEdit() {
    saving.value = true
    errorMsg.value = ''
    try {
      await $fetch(`/api/custom-orders/${orderId.value}`, {
      method: 'PUT',
      body: { ...form.value, consumableLotSale: lotSale.value }
    })
      editing.value = false
      await refresh()
    } catch (e) {
      errorMsg.value = e.data?.statusMessage || 'Gagal menyimpan'
    } finally {
      saving.value = false
    }
  }

  // --- Baris penawaran (draft lokal, baru tersimpan saat Simpan/aksi status) ---
  const lineDraft = ref([])
  const { serviceList, addFromMaster: addTarif, addCustom: addCustomTarif } = useRabTarif(lineDraft)
  const { lotKind, customLotSale, lotSale, setLotKind } = useRabConsumableLot(
    () => order.value?.consumableLotSale
  )
  const savingLines = ref(false)
  const lineError = ref('')

  watch(
    () => order.value?.lines,
    (lines) => {
      if (!savingLines.value) lineDraft.value = (lines || []).map((l) => ({ ...l }))
    },
    { immediate: true }
  )

  async function persistLines() {
    lineError.value = ''
    savingLines.value = true
    try {
      await $fetch(`/api/custom-orders/${orderId.value}`, {
        method: 'PUT',
        body: {
          date: order.value.date,
          customerName: order.value.customerName,
          title: order.value.title,
          notes: order.value.notes || '',
          jobType: order.value.jobType || null,
          consumableLotSale: lotSale.value,
          lines: lineDraft.value
        }
      })
      await refresh()
      return true
    } catch (e) {
      lineError.value = e.data?.statusMessage || 'Gagal menyimpan baris'
      return false
    } finally {
      savingLines.value = false
    }
  }

  async function saveLines() {
    if (await persistLines()) useToast().success('Baris RAB tersimpan')
  }

  // --- Aksi status RAB ---
  const acting = ref('')

  async function markSent() {
    if (!(await persistLines())) return
    acting.value = 'sent'
    try {
      await $fetch(`/api/custom-orders/${orderId.value}/send`, { method: 'POST' })
      await refresh()
      useToast().success('RAB ditandai dikirim')
    } catch (e) {
      useToast().error(e.data?.statusMessage || 'Gagal menandai dikirim')
    } finally {
      acting.value = ''
    }
  }

  async function markDeal() {
    if (!(await persistLines())) return
    const ok = await useConfirm().confirm(
      `Deal RAB "${order.value.title}"? Akan dibuat proyek baru. Kas dan stok belum berubah.`,
      { title: 'Deal jadi proyek', confirmText: 'Ya, Deal', variant: 'primary' }
    )
    if (!ok) return
    acting.value = 'deal'
    try {
      const updated = await $fetch(`/api/custom-orders/${orderId.value}/deal`, { method: 'POST' })
      useToast().success('Proyek dibuat dari RAB')
      await navigateTo(`/projects/${updated.projectId || updated.project?.id}`)
    } catch (e) {
      useToast().error(e.data?.statusMessage || 'Gagal Deal')
    } finally {
      acting.value = ''
    }
  }

  async function markLost() {
    const ok = await useConfirm().confirm(
      `Tandai RAB "${order.value.title}" sebagai Tidak deal?`,
      { title: 'Tidak deal', confirmText: 'Ya, tandai', variant: 'warning' }
    )
    if (!ok) return
    acting.value = 'lost'
    try {
      await $fetch(`/api/custom-orders/${orderId.value}/lost`, { method: 'POST' })
      await refresh()
      useToast().success('RAB ditandai Tidak deal')
    } catch (e) {
      useToast().error(e.data?.statusMessage || 'Gagal menandai')
    } finally {
      acting.value = ''
    }
  }

  // --- Lampiran (upload pakai XHR agar ada progres/per-file error) ---
  const fileInput = ref(null)
  const uploading = ref(false)
  const uploadError = ref('')

  function uploadOne(file) {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest()
      const data = new FormData()
      data.append('file', file)
      xhr.open('POST', `/api/custom-orders/${orderId.value}/files`)
      xhr.withCredentials = true
      xhr.onload = () => {
        let body = null
        try {
          body = xhr.responseText ? JSON.parse(xhr.responseText) : null
        } catch {
          body = null
        }
        if (xhr.status >= 200 && xhr.status < 300) resolve(body)
        else reject(new Error(body?.statusMessage || `Upload gagal (${xhr.status})`))
      }
      xhr.onerror = () => reject(new Error('Koneksi upload gagal'))
      xhr.send(data)
    })
  }

  async function uploadFiles(event) {
    const selected = Array.from(event?.target?.files || [])
    if (!selected.length) return
    uploading.value = true
    uploadError.value = ''
    const errors = []
    for (const file of selected) {
      try {
        await uploadOne(file)
      } catch (e) {
        errors.push(`${file.name}: ${e.message}`)
      }
    }
    if (fileInput.value) fileInput.value.value = ''
    if (errors.length) uploadError.value = errors.join('\n')
    uploading.value = false
    await refresh()
  }

  async function deleteFile(f) {
    if (!(await useConfirm().confirm(`Hapus file "${f.filename}"?`, { title: 'Hapus file' }))) return
    await $fetch(`/api/custom-order-files/${f.id}`, { method: 'DELETE' })
    await refresh()
  }

  function isModel(name) {
    return MODEL_RE.test(name || '')
  }

  function isImage(name) {
    return IMAGE_RE.test(name || '')
  }

  function formatSize(bytes) {
    if (bytes >= 1024 * 1024) return (bytes / 1024 / 1024).toFixed(1) + ' MB'
    if (bytes >= 1024) return (bytes / 1024).toFixed(0) + ' KB'
    return bytes + ' B'
  }

  return {
    order,
    settings,
    refresh,
    files,
    locked,
    canEdit,
    marginPercent,
    priceRounding,
    editing,
    form,
    saving,
    errorMsg,
    startEdit,
    saveEdit,
    lineDraft,
    serviceList,
    addTarif,
    addCustomTarif,
    lotKind,
    customLotSale,
    lotSale,
    setLotKind,
    savingLines,
    lineError,
    persistLines,
    saveLines,
    acting,
    markSent,
    markDeal,
    markLost,
    fileInput,
    uploading,
    uploadError,
    uploadFiles,
    deleteFile,
    isModel,
    isImage,
    formatSize
  }
}
