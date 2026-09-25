import { useDb, schema } from '../../db/index.js'
import { logAudit } from '../../utils/audit.js'
import { setExpenseProducts } from '../../utils/expenseProducts.js'
import { loadTechnicianWork } from '../../utils/technicianWork.js'

export default defineEventHandler(async (event) => {
  const body = (await readBody(event).catch(() => null)) || {}
  const date = String(body.date || '').trim()
  const technicianId = Number(body.technicianId)
  const rawLines = Array.isArray(body.lines)
    ? body.lines
    : (Array.isArray(body.productIds) ? body.productIds : []).map((id) => ({ productId: id }))
  const seen = new Set()
  const requested = []
  for (const row of rawLines) {
    const productId = Number(row?.productId || row?.id)
    if (!Number.isInteger(productId) || productId <= 0 || seen.has(productId)) continue
    seen.add(productId)
    requested.push({
      productId,
      amount: row?.amount
    })
  }
  if (!date) throw createError({ statusCode: 400, statusMessage: 'Tanggal wajib diisi' })
  if (!Number.isInteger(technicianId) || technicianId <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'Pilih teknisi' })
  }
  if (!requested.length) {
    throw createError({ statusCode: 400, statusMessage: 'Centang minimal satu proyek' })
  }

  const work = await loadTechnicianWork(technicianId)
  const byId = new Map((work.projects || []).map((row) => [row.id, row]))
  const lines = requested.map((item) => {
    const row = byId.get(item.productId)
    if (!row) throw createError({ statusCode: 400, statusMessage: 'Ada proyek yang tidak terkait teknisi ini' })
    if (row.unpaidAmount <= 0) {
      throw createError({ statusCode: 400, statusMessage: `Upah "${row.name}" sudah lunas` })
    }
    const amount = item.amount == null || item.amount === ''
      ? row.unpaidAmount
      : Math.max(Math.round(Number(item.amount) || 0), 0)
    if (amount <= 0) {
      throw createError({ statusCode: 400, statusMessage: `Isi nominal yang diambil untuk "${row.name}"` })
    }
    if (amount > row.unpaidAmount) {
      throw createError({
        statusCode: 400,
        statusMessage: `Upah "${row.name}" hanya sisa ${row.unpaidAmount.toLocaleString('id-ID')}`
      })
    }
    return { ...row, payoutAmount: amount }
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
          amount: project.payoutAmount,
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
