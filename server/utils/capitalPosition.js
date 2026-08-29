import { saleMoney } from './salePayment.js'
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

function saleNet(row) {
  const { net } = saleMoney({
    salePricePerUnit: row.salePricePerUnit,
    quantity: row.quantity,
    discountAmount: row.discountAmount
  })
  return net
}

export function salesInflow(salesRows) {
  return salesRows.reduce((sum, row) => {
    if (row.paymentStatus === 'unpaid') return sum
    return sum + saleNet(row)
  }, 0)
}

export function salesReceivable(salesRows) {
  return salesRows.reduce((sum, row) => {
    if (row.paymentStatus !== 'unpaid') return sum
    return sum + saleNet(row)
  }, 0)
}

export function totalCashOut(expenseRows) {
  return expenseRows.reduce((sum, row) => sum + (Number(row.amount) || 0), 0)
}

export function equipmentAssetTotal(machineRows) {
  return (machineRows || []).reduce((sum, row) => {
    if (row.acquisition === 'purchased') return sum
    return sum + machineTotalValue(row)
  }, 0)
}

export function capitalPosition({ capitalRows, salesRows, expenseRows, machineRows = [] }) {
  const owner = ownerCapital(capitalRows)
  const salesRevenue = salesInflow(salesRows)
  const receivable = salesReceivable(salesRows)
  const totalExpenses = totalCashOut(expenseRows)
  const equipmentAssets = equipmentAssetTotal(machineRows)
  return {
    ...owner,
    salesRevenue,
    salesReceivable: receivable,
    totalExpenses,
    equipmentAssets,
    estimatedCash: owner.netCapital + salesRevenue - totalExpenses
  }
}
