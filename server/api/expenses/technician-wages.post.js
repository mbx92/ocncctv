import { useDb, schema } from '../../db/index.js'
import { logAudit } from '../../utils/audit.js'
import { setExpenseProducts } from '../../utils/expenseProducts.js'
import { loadTechnicianWork } from '../../utils/technicianWork.js'

export default defineEventHandler(async (event) => {
  const body = (await readBody(event).catch(() => null)) || {}
  const date = String(body.date || '').trim()
  const technicianId = Number(body.technicianId)
  const productIds = [...new Set((Array.isArray(body.productIds) ? body.productIds : []).map(Number).filter((id) => id > 0))]
  if (!date) throw createError({ statusCode: 400, statusMessage: 'Tanggal wajib diisi' })
  if (!Number.isInteger(technicianId) || technicianId <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'Pilih teknisi' })
  }
  if (!productIds.length) {
    throw createError({ statusCode: 400, statusMessage: 'Centang minimal satu proyek' })
  }

  const work = await loadTechnicianWork(technicianId)
  const byId = new Map((work.projects || []).map((row) => [row.id, row]))
  const lines = productIds.map((id) => {
    const row = byId.get(id)
    if (!row) throw createError({ statusCode: 400, statusMessage: 'Ada proyek yang tidak terkait teknisi ini' })
    if (row.unpaidAmount <= 0) {
      throw createError({ statusCode: 400, statusMessage: `Upah "${row.name}" sudah lunas` })
    }
    return row
  })

  const db = useDb()
  const created = await db.transaction(async (tx) => {
    const rows = []
    for (const project of lines) {
      const [row] = await tx
        .insert(schema.expenses)
        .values({
          date,
          category: 'technician',
          description: `Upah ${work.technician.name} · ${project.name}`,
          amount: project.unpaidAmount,
          relatedProductId: project.id,
          technicianId: work.technician.id
        })
        .returning()
      await setExpenseProducts(tx, schema, row.id, [project.id])
      rows.push(row)
    }
    return rows
  })

  const total = created.reduce((sum, row) => sum + row.amount, 0)
  await logAudit(event, {
    action: 'create',
    entity: 'expense',
    entityId: created[0]?.id,
    summary: `Catat upah ${work.technician.name} (${created.length} proyek, Rp ${total.toLocaleString('id-ID')})`
  })
  return { ok: true, count: created.length, total, expenses: created }
})
