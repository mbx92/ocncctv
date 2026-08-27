import { eq } from 'drizzle-orm'
import { useDb, schema } from '../../../db/index.js'
import { requireAdmin } from '../../../utils/rbac.js'
import { logAudit } from '../../../utils/audit.js'

export default defineEventHandler(async (event) => {
  requireAdmin(event)
  const id = Number(getRouterParam(event, 'id'))
  const body = await readBody(event)
  const db = useDb()

  const [product] = await db.select({ id: schema.products.id }).from(schema.products).where(eq(schema.products.id, id))
  if (!product) throw createError({ statusCode: 404, statusMessage: 'Proyek tidak ditemukan' })

  const wages = (Array.isArray(body?.wages) ? body.wages : [])
    .map((row, i) => {
      const name = String(row?.name || '').trim()
      const amount = Math.max(Math.round(Number(row?.amount) || 0), 0)
      return { name, amount, sortOrder: i }
    })
    .filter((row) => row.name)

  await db.transaction(async (tx) => {
    await tx.delete(schema.projectTechnicianWages).where(eq(schema.projectTechnicianWages.productId, id))
    if (!wages.length) return
    await tx.insert(schema.projectTechnicianWages).values(
      wages.map((row) => ({
        productId: id,
        name: row.name,
        amount: row.amount,
        sortOrder: row.sortOrder
      }))
    )
  })

  await logAudit(event, {
    action: 'update',
    entity: 'product',
    entityId: id,
    summary: `Ubah upah teknisi proyek id ${id} (${wages.length} orang)`
  })
  return { ok: true, wages }
})
