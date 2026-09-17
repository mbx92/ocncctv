import { and, gte, lte, eq, desc } from 'drizzle-orm'
import { useDb, schema } from '../../db/index.js'
import { capitalPosition } from '../../utils/capitalPosition.js'
import { loadUnsoldProjectDownPayments } from '../../utils/projectRevenue.js'

// Modal kas = setoran − penarikan.
// Aset peralatan = nilai alat yang sudah dimiliki (bukan belanja baru).
// Estimasi kas = modal kas + penjualan − semua pengeluaran (termasuk beli peralatan baru).
export default defineEventHandler(async (event) => {
  const q = getQuery(event)
  const db = useDb()

  const conds = []
  if (q.type) conds.push(eq(schema.capitalTransactions.type, q.type))
  if (q.dateFrom) conds.push(gte(schema.capitalTransactions.date, q.dateFrom))
  if (q.dateTo) conds.push(lte(schema.capitalTransactions.date, q.dateTo))

  const [transactions, salesRows, expenseRows, machineRows, unsoldDownPayments] = await Promise.all([
    db
      .select()
      .from(schema.capitalTransactions)
      .where(conds.length ? and(...conds) : undefined)
      .orderBy(desc(schema.capitalTransactions.date), desc(schema.capitalTransactions.id)),
    db
      .select({
        quantity: schema.sales.quantity,
        salePricePerUnit: schema.sales.salePricePerUnit,
        discountAmount: schema.sales.discountAmount,
        downPaymentAmount: schema.sales.downPaymentAmount,
        paymentStatus: schema.sales.paymentStatus
      })
      .from(schema.sales),
    db
      .select({
        amount: schema.expenses.amount,
        category: schema.expenses.category,
        categoryName: schema.expenseCategories.name,
        categoryColor: schema.expenseCategories.color
      })
      .from(schema.expenses)
      .leftJoin(schema.expenseCategories, eq(schema.expenses.category, schema.expenseCategories.key)),
    db
      .select({
        purchasePrice: schema.machines.purchasePrice,
        quantity: schema.machines.quantity,
        acquisition: schema.machines.acquisition
      })
      .from(schema.machines),
    loadUnsoldProjectDownPayments(db, schema)
  ])

  const summary = capitalPosition({
    capitalRows: transactions,
    salesRows,
    expenseRows,
    machineRows,
    unsoldDownPayments
  })

  return {
    transactions,
    summary
  }
})
