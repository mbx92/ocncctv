export function splitEqualAmount(total, count) {
  const n = Math.max(Math.round(Number(count) || 0), 0)
  const amount = Math.max(Math.round(Number(total) || 0), 0)
  if (!n) return []
  const base = Math.floor(amount / n)
  const remainder = amount - base * n
  return Array.from({ length: n }, (_, index) => base + (index < remainder ? 1 : 0))
}

export function distributeWagesFromServiceSale(serviceSale, wageRows) {
  const total = Math.max(Math.round(Number(serviceSale) || 0), 0)
  const eligible = (wageRows || []).map((row, index) => ({ row, index })).filter(({ row }) => row.technicianId)
  if (!eligible.length) return wageRows || []

  const amounts = splitEqualAmount(total, eligible.length)
  const next = (wageRows || []).map((row) => ({ ...row }))
  eligible.forEach(({ index }, i) => {
    next[index] = { ...next[index], amount: amounts[i] }
  })
  return next
}

export function wageAllocationLeft(serviceSale, wageRows) {
  const total = Math.max(Math.round(Number(serviceSale) || 0), 0)
  const allocated = (wageRows || []).reduce(
    (sum, row) => sum + Math.max(Math.round(Number(row.amount) || 0), 0),
    0
  )
  return total - allocated
}

export function findProjectWageForTechnician(wages, technicianId) {
  const id = String(technicianId || '')
  if (!id) return null
  return (wages || []).find((row) => String(row.technicianId) === id) || null
}
