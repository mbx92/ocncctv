export function parseServiceBody(body) {
  const name = String(body?.name || '').trim()
  if (!name) throw createError({ statusCode: 400, statusMessage: 'Nama wajib diisi' })
  return {
    name,
    unit: String(body?.unit || 'titik').trim() || 'titik',
    salePrice: Math.max(Math.round(Number(body?.salePrice) || 0), 0),
    notes: String(body?.notes || '').trim() || null
  }
}
