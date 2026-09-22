import { and, eq, inArray, isNotNull, ne, sql } from 'drizzle-orm'
import { schema } from '../db/index.js'
import { loadTechnicianWork } from './technicianWork.js'
import { isOwnerTechnicianName, isPersonalCategory, personalCapitalShortfall } from './personalExpense.js'

function money(value) {
  return Math.max(Math.round(Number(value) || 0), 0)
}

export async function loadPersonalDraw(db, { excludeExpenseId } = {}) {
  const [technicians, categoryRows] = await Promise.all([
    db.select({ id: schema.technicians.id, name: schema.technicians.name }).from(schema.technicians),
    db.select({ key: schema.expenseCategories.key, name: schema.expenseCategories.name }).from(schema.expenseCategories)
  ])
  const owner = technicians.find((row) => isOwnerTechnicianName(row.name)) || null
  const personalKeys = categoryRows.filter((row) => isPersonalCategory(row)).map((row) => row.key)

  let work = null
  if (owner) {
    work = await loadTechnicianWork(owner.id)
  }

  let personalSpent = 0
  if (personalKeys.length) {
    const conds = [inArray(schema.expenses.category, personalKeys)]
    if (excludeExpenseId) conds.push(ne(schema.expenses.id, excludeExpenseId))
    const [sumRow] = await db
      .select({ total: sql`coalesce(sum(${schema.expenses.amount}), 0)`.mapWith(Number) })
      .from(schema.expenses)
      .where(and(...conds))
    personalSpent = money(sumRow?.total)
  }

  const wageTotal = work?.summary?.wageTotal || 0
  return {
    technician: work?.technician || (owner ? { id: owner.id, name: owner.name } : null),
    wageTotal,
    personalSpent,
    remaining: wageTotal - personalSpent,
    projectCount: work?.summary?.projectCount || 0,
    projects: (work?.projects || []).map((p) => ({
      id: p.id,
      name: p.name,
      wageAmount: p.wageAmount
    }))
  }
}

function withdrawalNotes(expense) {
  const desc = String(expense.description || '').trim()
  return desc ? `Pengeluaran pribadi: ${desc}` : 'Pengeluaran pribadi (upah Pande tidak cukup)'
}

export async function resyncPersonalCapitalWithdrawals(db) {
  const draw = await loadPersonalDraw(db)
  const [categoryRows, expenseRows] = await Promise.all([
    db.select({ key: schema.expenseCategories.key, name: schema.expenseCategories.name }).from(schema.expenseCategories),
    db
      .select()
      .from(schema.expenses)
      .orderBy(schema.expenses.date, schema.expenses.id)
  ])
  const personalKeys = new Set(categoryRows.filter((row) => isPersonalCategory(row)).map((row) => row.key))
  const personalExpenses = expenseRows.filter((row) => personalKeys.has(row.category))
  const personalIds = new Set(personalExpenses.map((row) => row.id))
  const linked = await db
    .select({ id: schema.capitalTransactions.id, expenseId: schema.capitalTransactions.expenseId })
    .from(schema.capitalTransactions)
    .where(isNotNull(schema.capitalTransactions.expenseId))
  for (const row of linked) {
    if (!personalIds.has(row.expenseId)) {
      await db.delete(schema.capitalTransactions).where(eq(schema.capitalTransactions.id, row.id))
    }
  }
  let remaining = draw.wageTotal
  const byExpenseId = new Map()
  for (const expense of personalExpenses) {
    const category = categoryRows.find((row) => row.key === expense.category) || expense.category
    const withdrawal = await syncPersonalCapitalWithdrawal(db, {
      expense,
      category,
      remainingWithoutExpense: remaining
    })
    if (withdrawal) byExpenseId.set(expense.id, withdrawal)
    remaining -= money(expense.amount)
  }
  return byExpenseId
}

export async function syncPersonalCapitalWithdrawal(db, { expense, category, remainingWithoutExpense }) {
  const isPersonal = isPersonalCategory(category || expense.category)
  const shortfall = isPersonal ? personalCapitalShortfall(expense.amount, remainingWithoutExpense) : 0
  const [existing] = await db
    .select()
    .from(schema.capitalTransactions)
    .where(eq(schema.capitalTransactions.expenseId, expense.id))

  if (shortfall <= 0) {
    if (existing) {
      await db.delete(schema.capitalTransactions).where(eq(schema.capitalTransactions.id, existing.id))
    }
    return null
  }

  const payload = {
    date: expense.date,
    type: 'withdrawal',
    amount: shortfall,
    notes: withdrawalNotes(expense),
    expenseId: expense.id
  }

  if (existing) {
    const [row] = await db
      .update(schema.capitalTransactions)
      .set(payload)
      .where(eq(schema.capitalTransactions.id, existing.id))
      .returning()
    return row
  }

  const [row] = await db.insert(schema.capitalTransactions).values(payload).returning()
  return row
}
