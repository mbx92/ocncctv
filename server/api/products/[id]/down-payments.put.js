import { eq } from 'drizzle-orm'
import { useDb, schema } from '../../../db/index.js'
import { requireAdmin } from '../../../utils/rbac.js'
import { logAudit } from '../../../utils/audit.js'
import { sanitizeText } from '../../../utils/sanitizeText.js'
import { downPaymentTotal } from '../../../utils/projectRevenue.js'

const METHODS = ['cash', 'transfer', 'other']

function parseDownPayments(body) {
  const incoming = Array.isArray(body?.downPayments) ? body.downPayments : []
  const rows = []
  for (const row of incoming) {
    const amount = Math.max(Math.round(Number(row?.amount) || 0), 0)
    const date = String(row?.date || '').slice(0, 10)
    if (!amount || !/^\d{4}-\d{2}-\d{2}$/.test(date)) continue
    const methodRaw = String(row?.method || 'transfer')
    const method = METHODS.includes(methodRaw) ? methodRaw : 'transfer'
    rows.push({
      date,
      amount,
      method,
      notes: row?.notes ? sanitizeText(String(row.notes)) || null : null
    })
  }
  return rows
}

export default defineEventHandler(async (event) => {
  requireAdmin(event)
  const id = Number(getRouterParam(event, 'id'))
  const body = await readBody(event)
  const db = useDb()

  const [product] = await db.select({ id: schema.products.id }).from(schema.products).where(eq(schema.products.id, id))
  if (!product) throw createError({ statusCode: 404, statusMessage: 'Proyek tidak ditemukan' })

  const rows = parseDownPayments(body)

  await db.transaction(async (tx) => {
    await tx.delete(schema.projectDownPayments).where(eq(schema.projectDownPayments.productId, id))
    if (!rows.length) return
    await tx.insert(schema.projectDownPayments).values(rows.map((row) => ({ productId: id, ...row })))
  })

  await logAudit(event, {
    action: 'update',
    entity: 'product',
    entityId: id,
    summary: `Ubah DP proyek id ${id} (${rows.length} catatan, ${downPaymentTotal(rows)})`
  })
  return { ok: true, downPayments: rows, downPaymentTotal: downPaymentTotal(rows) }
})
