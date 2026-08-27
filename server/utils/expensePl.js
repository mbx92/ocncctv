// Peralatan (kategori machine): beli baru memotong kas, tapi bukan opex periodik.
// Perlengkapan (kategori material): habis pakai, bukan HPP kamera — potong laba dan kas.
export function isOperatingExpenseCategory(category) {
  return category !== 'machine'
}
