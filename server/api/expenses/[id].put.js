import { eq } from 'drizzle-orm'
import { useDb, schema } from '../../db/index.js'
import { logAudit } from '../../utils/audit.js'
import { setExpenseProducts } from '../../utils/expenseProducts.js'
import { assertExpenseCategory } from '../../utils/expenseCategory.js'
import { assertNotMachineLinkedExpense } from '../../utils/machineExpense.js'
import { findTechnician } from '../../utils/technicians.js'

export default defineEventHandler(async (event) => {
  const id = Number(getRouterParam(event, 'id'))
  const body = await readBody(event)
  const db = useDb()
  const relatedProductId = body.relatedProductId ? Number(body.relatedProductId) : null
  const cat = await assertExpenseCategory(db, schema, body.category)
  const tech = await findTechnician(db, schema, body.technicianId)
  if (body.technicianId && !tech) {
    throw createError({ statusCode: 400, statusMessage: 'Teknisi tidak ditemukan' })
  }
  const description = String(body.description || '').trim() || (tech ? `Upah ${tech.name}` : '')
  if (!body.date || !description) {
    throw createError({ statusCode: 400, statusMessage: 'Tanggal dan deskripsi wajib diisi' })
  }
  const [prev] = await db.select().from(schema.expenses).where(eq(schema.expenses.id, id))
  if (!prev) throw createError({ statusCode: 404, statusMessage: 'Pengeluaran tidak ditemukan' })
  await assertNotMachineLinkedExpense(db, schema, id)

  const existingLinks = await db
    .select({ productId: schema.expenseProducts.productId })
    .from(schema.expenseProducts)
    .where(eq(schema.expenseProducts.expenseId, id))

  const rows = await db
    .update(schema.expenses)
    .set({
      date: body.date,
      category: cat.key,
      description,
      amount: Math.round(Number(body.amount) || 0),
      relatedProductId,
      technicianId: tech?.id || null
    })
    .where(eq(schema.expenses.id, id))
    .returning()

  // Jangan timpa tautan multi-produk (dari pembelian) jika produk yang
  // dipilih masih salah satu yang sudah tertaut.
  const keepMulti =
    existingLinks.length > 1 && relatedProductId && existingLinks.some((l) => l.productId === relatedProductId)
  if (!keepMulti) {
    await setExpenseProducts(db, schema, id, relatedProductId ? [relatedProductId] : [])
  }

  await logAudit(event, { action: 'update', entity: 'expense', entityId: id, summary: `Ubah pengeluaran "${rows[0].description}"` })
  return rows[0]
})
