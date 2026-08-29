// Kategori yang bukan biaya operasional periodik:
// - machine: belanja aset (potong kas, tidak masuk laba rugi)
// - material / packaging: modal barang — sudah dihitung di HPP penjualan (COGS), bukan opex
const NON_OPERATING_EXPENSE_CATEGORIES = new Set(['machine', 'material', 'packaging'])

export function isOperatingExpenseCategory(category) {
  return !NON_OPERATING_EXPENSE_CATEGORIES.has(category)
}
