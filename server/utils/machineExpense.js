import { eq } from 'drizzle-orm'
import { localDateStr } from './dates.js'
import { machineTotalValue, parseMachineQuantity } from './machines.js'

const EQUIPMENT_CATEGORY = 'machine'

export function normalizeAcquisition(value) {
  return value === 'purchased' ? 'purchased' : 'owned'
}

function expensePayload(machine) {
  const qty = parseMachineQuantity(machine.quantity)
  const total = machineTotalValue(machine)
  const qtyNote = qty > 1 ? ` (${qty}× ${Math.round(Number(machine.purchasePrice) || 0).toLocaleString('id-ID')})` : ''
  return {
    date: machine.purchaseDate || localDateStr(),
    category: EQUIPMENT_CATEGORY,
    description: `Pembelian peralatan: ${machine.name}${qtyNote}`,
    amount: total
  }
}

export async function syncMachinePurchaseExpense(tx, schema, machine) {
  const acquisition = normalizeAcquisition(machine.acquisition)
  const payload = expensePayload(machine)
  const shouldExpense = acquisition === 'purchased' && payload.amount > 0

  if (!shouldExpense) {
    if (machine.expenseId) {
      await tx.delete(schema.expenses).where(eq(schema.expenses.id, machine.expenseId))
      const [updated] = await tx
        .update(schema.machines)
        .set({ expenseId: null })
        .where(eq(schema.machines.id, machine.id))
        .returning()
      return updated
    }
    return machine
  }

  if (machine.expenseId) {
    await tx.update(schema.expenses).set(payload).where(eq(schema.expenses.id, machine.expenseId))
    return machine
  }

  const [expense] = await tx.insert(schema.expenses).values(payload).returning()
  const [updated] = await tx
    .update(schema.machines)
    .set({ expenseId: expense.id })
    .where(eq(schema.machines.id, machine.id))
    .returning()
  return updated
}

export async function deleteLinkedMachineExpense(tx, schema, expenseId) {
  if (!expenseId) return
  await tx.delete(schema.expenses).where(eq(schema.expenses.id, expenseId))
}

export async function assertNotMachineLinkedExpense(db, schema, expenseId) {
  const [row] = await db
    .select({ id: schema.machines.id, name: schema.machines.name })
    .from(schema.machines)
    .where(eq(schema.machines.expenseId, expenseId))
  if (row) {
    throw createError({
      statusCode: 409,
      statusMessage: `Pengeluaran ini dari peralatan "${row.name}". Ubah atau hapus lewat halaman Peralatan.`
    })
  }
}
