import { useDb, schema } from '../../db/index.js'
import { logAudit } from '../../utils/audit.js'
import { setExpenseProducts } from '../../utils/expenseProducts.js'
import { assertExpenseCategory } from '../../utils/expenseCategory.js'
import { findTechnician } from '../../utils/technicians.js'

export default defineEventHandler(async (event) => {
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
  const rows = await db
    .insert(schema.expenses)
    .values({
      date: body.date,
      category: cat.key,
      description,
      amount: Math.round(Number(body.amount) || 0),
      relatedProductId,
      technicianId: tech?.id || null
    })
    .returning()
  await setExpenseProducts(db, schema, rows[0].id, relatedProductId ? [relatedProductId] : [])
  await logAudit(event, {
    action: 'create',
    entity: 'expense',
    entityId: rows[0].id,
    summary: `Catat pengeluaran "${rows[0].description}" (Rp ${rows[0].amount.toLocaleString('id-ID')})`
  })
  return rows[0]
})
