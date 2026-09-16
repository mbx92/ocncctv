export async function copyText(value, successMessage = 'Nama barang disalin') {
  const text = String(value || '').trim()
  if (!text) return false
  try {
    await navigator.clipboard.writeText(text)
    useToast().success(successMessage)
    return true
  } catch {
    useToast().error('Tidak bisa menyalin')
    return false
  }
}
