import { desc, eq, inArray } from 'drizzle-orm'
import { isPersonalCategory } from './personalExpense.js'

function money(value) {
  return Math.max(Math.round(Number(value) || 0), 0)
}

export function isProjectRevenueExpense(expense) {
  const key = String(expense?.category || '')
    .trim()
    .toLowerCase()
  if (key === 'technician') return false
  if (isPersonalCategory(expense)) return false
  return true
}

export function sumProjectExpenses(expenses) {
  return (expenses || []).reduce((sum, row) => sum + money(row.allocatedAmount ?? row.amount), 0)
}

// Pengeluaran yang terikat proyek, kecuali upah teknisi (sudah di wageTotal)
// dan pembelian supplier (sudah masuk HPP/stok).
export async function loadProjectExpensesByProduct(db, schema, productIds) {
  const ids = [...new Set((productIds || []).filter(Boolean))]
  const map = new Map(ids.map((id) => [id, []]))
  if (!ids.length) return map

  const linkRows = await db
    .select({
      expenseId: schema.expenseProducts.expenseId,
      productId: schema.expenseProducts.productId
    })
    .from(schema.expenseProducts)
    .where(inArray(schema.expenseProducts.productId, ids))

  const relatedRows = await db
    .select({
      expenseId: schema.expenses.id,
      productId: schema.expenses.relatedProductId
    })
    .from(schema.expenses)
    .where(inArray(schema.expenses.relatedProductId, ids))

  const productsByExpense = new Map()
  for (const row of [...linkRows, ...relatedRows]) {
    const expenseId = Number(row.expenseId)
    const productId = Number(row.productId)
    if (!expenseId || !productId) continue
    const set = productsByExpense.get(expenseId) || new Set()
    set.add(productId)
    productsByExpense.set(expenseId, set)
  }

  const expenseIds = [...productsByExpense.keys()]
  if (!expenseIds.length) return map

  const purchaseLinks = await db
    .select({ expenseId: schema.supplierPurchases.expenseId })
    .from(schema.supplierPurchases)
    .where(inArray(schema.supplierPurchases.expenseId, expenseIds))
  const purchaseExpenseIds = new Set(purchaseLinks.map((row) => Number(row.expenseId)).filter(Boolean))

  const rows = await db
    .select({
      id: schema.expenses.id,
      date: schema.expenses.date,
      category: schema.expenses.category,
      categoryName: schema.expenseCategories.name,
      description: schema.expenses.description,
      amount: schema.expenses.amount
    })
    .from(schema.expenses)
    .leftJoin(schema.expenseCategories, eq(schema.expenses.category, schema.expenseCategories.key))
    .where(inArray(schema.expenses.id, expenseIds))
    .orderBy(desc(schema.expenses.date), desc(schema.expenses.id))

  for (const row of rows) {
    if (!isProjectRevenueExpense(row)) continue
    if (purchaseExpenseIds.has(Number(row.id))) continue
    const linked = [...(productsByExpense.get(row.id) || [])].filter((id) => map.has(id))
    if (!linked.length) continue
    const share = Math.round(money(row.amount) / linked.length)
    for (const productId of linked) {
      map.get(productId)?.push({
        id: row.id,
        date: row.date,
        category: row.category,
        categoryName: row.categoryName || null,
        description: row.description,
        amount: money(row.amount),
        allocatedAmount: share
      })
    }
  }

  return map
}
