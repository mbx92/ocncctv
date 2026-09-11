const SATUAN = ['', 'satu', 'dua', 'tiga', 'empat', 'lima', 'enam', 'tujuh', 'delapan', 'sembilan']

function threeDigits(n) {
  const ratus = Math.floor(n / 100)
  const puluh = Math.floor((n % 100) / 10)
  const satu = n % 10
  const parts = []
  if (ratus) parts.push(ratus === 1 ? 'seratus' : `${SATUAN[ratus]} ratus`)
  if (puluh === 1) {
    parts.push(satu === 0 ? 'sepuluh' : satu === 1 ? 'sebelas' : `${SATUAN[satu]} belas`)
  } else {
    if (puluh) parts.push(`${SATUAN[puluh]} puluh`)
    if (satu) parts.push(SATUAN[satu])
  }
  return parts.join(' ')
}

export function terbilang(value) {
  let n = Math.max(Math.round(Number(value) || 0), 0)
  if (!n) return 'nol'
  const scales = [
    [1_000_000_000_000, 'triliun'],
    [1_000_000_000, 'miliar'],
    [1_000_000, 'juta'],
    [1_000, 'ribu']
  ]
  const parts = []
  for (const [unit, name] of scales) {
    if (n < unit) continue
    const chunk = Math.floor(n / unit)
    n %= unit
    if (chunk === 1 && unit === 1_000) parts.push('seribu')
    else parts.push(`${threeDigits(chunk)} ${name}`)
  }
  if (n) parts.push(threeDigits(n))
  return parts.filter(Boolean).join(' ').replace(/\s+/g, ' ').trim()
}

export function terbilangRupiah(value) {
  const words = terbilang(value)
  return `${words.charAt(0).toUpperCase()}${words.slice(1)} rupiah`
}
