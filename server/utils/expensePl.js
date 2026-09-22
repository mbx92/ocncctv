// Kategori yang bukan biaya operasional periodik:
// - machine: belanja aset (potong kas, tidak masuk laba rugi)
// - material / packaging: modal barang — sudah dihitung di HPP penjualan (COGS), bukan opex
// - pribadi: owner draw dari upah Pande, bukan biaya operasional workshop
const NON_OPERATING_EXPENSE_CATEGORIES = new Set(['machine', 'material', 'packaging', 'pribadi'])

export function isOperatingExpenseCategory(category) {
  const key = String(category || '').trim().toLowerCase()
  if (NON_OPERATING_EXPENSE_CATEGORIES.has(key)) return false
  if (key.includes('pribadi')) return false
  return true
}
