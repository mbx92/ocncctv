import { saleSettled } from './salePayment.js'
import { machineTotalValue } from './machines.js'

// Posisi modal kas + estimasi kas.
// Alat yang sudah dimiliki (acquisition=owned) tidak masuk pengeluaran.
// Beli peralatan baru (kategori machine) memotong estimasi kas.

export function ownerCapital(rows) {
  const totalDeposit = rows.filter((r) => r.type === 'deposit').reduce((a, r) => a + r.amount, 0)
  const totalWithdrawal = rows.filter((r) => r.type === 'withdrawal').reduce((a, r) => a + r.amount, 0)
  return {
    totalDeposit,
    totalWithdrawal,
    netCapital: totalDeposit - totalWithdrawal
  }
}

function saleRowSettled(row) {
  return saleSettled({
    salePricePerUnit: row.salePricePerUnit,
    quantity: row.quantity,
    discountAmount: row.discountAmount,
    downPaymentAmount: row.downPaymentAmount
  })
}

export function salesInflow(salesRows, unsoldDownPayments = 0) {
  const fromSales = salesRows.reduce((sum, row) => {
    const settled = saleRowSettled(row)
    if (row.paymentStatus === 'unpaid') return sum + settled.downPayment
    return sum + settled.net
  }, 0)
  return fromSales + Math.max(Math.round(Number(unsoldDownPayments) || 0), 0)
}

export function salesReceivable(salesRows) {
  return salesRows.reduce((sum, row) => {
    if (row.paymentStatus !== 'unpaid') return sum
    return sum + saleRowSettled(row).due
  }, 0)
}

export function totalCashOut(expenseRows) {
  return expenseRows.reduce((sum, row) => sum + (Number(row.amount) || 0), 0)
}

export function expensesByCategory(expenseRows) {
  const map = new Map()
  for (const row of expenseRows || []) {
    const key = String(row.category || 'other')
    const prev = map.get(key) || {
      category: key,
      name: row.categoryName || (key === 'other' ? 'Lainnya' : key),
      color: row.categoryColor || null,
      amount: 0
    }
    if (row.categoryName) prev.name = row.categoryName
    if (row.categoryColor && !prev.color) prev.color = row.categoryColor
    prev.amount += Number(row.amount) || 0
    map.set(key, prev)
  }
  const total = [...map.values()].reduce((sum, row) => sum + row.amount, 0)
  return [...map.values()]
    .filter((row) => row.amount > 0)
    .sort((a, b) => b.amount - a.amount || a.name.localeCompare(b.name, 'id'))
    .map((row) => ({
      ...row,
      percent: total ? Math.round((row.amount / total) * 100) : 0
    }))
}

export function equipmentAssetTotal(machineRows) {
  return (machineRows || []).reduce((sum, row) => {
    if (row.acquisition === 'purchased') return sum
    return sum + machineTotalValue(row)
  }, 0)
}

export function capitalPosition({ capitalRows, salesRows, expenseRows, machineRows = [], unsoldDownPayments = 0 }) {
  const owner = ownerCapital(capitalRows)
  const salesRevenue = salesInflow(salesRows, unsoldDownPayments)
  const receivable = salesReceivable(salesRows)
  const totalExpenses = totalCashOut(expenseRows)
  const equipmentAssets = equipmentAssetTotal(machineRows)
  return {
    ...owner,
    salesRevenue,
    salesReceivable: receivable,
    totalExpenses,
    expensesByCategory: expensesByCategory(expenseRows),
    equipmentAssets,
    estimatedCash: owner.netCapital + salesRevenue - totalExpenses
  }
}
