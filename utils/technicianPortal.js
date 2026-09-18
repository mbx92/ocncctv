export function technicianPayStatus(row) {
  const wage = Math.max(Math.round(Number(row?.wageAmount) || 0), 0)
  const unpaid = Math.max(Math.round(Number(row?.unpaidAmount) || 0), 0)
  const paid = Math.max(Math.round(Number(row?.paidAmount) || 0), 0)
  if (wage <= 0) return { label: 'Tidak ada upah', class: 'bg-ink-100 text-ink-600' }
  if (unpaid <= 0) return { label: 'Sudah dibayar', class: 'bg-green-100 text-green-800' }
  if (paid > 0) return { label: 'Sebagian dibayar', class: 'bg-amber-100 text-amber-800' }
  return { label: 'Belum dibayar', class: 'bg-red-100 text-red-700' }
}
