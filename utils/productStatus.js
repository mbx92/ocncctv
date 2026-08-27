export const PRODUCT_STATUSES = ['waiting', 'in_progress', 'done']

export const productStatusLabel = {
  waiting: 'Menunggu',
  in_progress: 'Berjalan',
  done: 'Selesai',
  draft: 'Menunggu',
  rnd: 'Menunggu',
  active: 'Berjalan',
  discontinued: 'Selesai'
}

export const productStatusBadge = {
  waiting: 'bg-amber-100 text-amber-800',
  in_progress: 'bg-sky-100 text-sky-800',
  done: 'bg-green-100 text-green-700',
  draft: 'bg-amber-100 text-amber-800',
  rnd: 'bg-amber-100 text-amber-800',
  active: 'bg-sky-100 text-sky-800',
  discontinued: 'bg-green-100 text-green-700'
}

export function normalizeProductStatus(status) {
  if (status === 'in_progress' || status === 'active') return 'in_progress'
  if (status === 'done' || status === 'discontinued') return 'done'
  return 'waiting'
}

export function productStatusClass(status) {
  return productStatusBadge[normalizeProductStatus(status)] || productStatusBadge.waiting
}
