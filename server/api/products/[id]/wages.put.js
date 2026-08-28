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

  const techs = await db.select().from(schema.technicians)
  const byId = new Map(techs.map((t) => [t.id, t]))

  const incoming = Array.isArray(body?.wages) ? body.wages : []
  const seen = new Set()
  const wages = []
  for (const row of incoming) {
    const amount = Math.max(Math.round(Number(row?.amount) || 0), 0)
    const techId = Number(row?.technicianId) || 0
    const tech = byId.get(techId)
    if (!techId) continue
    if (!tech) {
      throw createError({ statusCode: 400, statusMessage: 'Pilih teknisi dari daftar' })
    }
    if (seen.has(tech.id)) {
      throw createError({ statusCode: 400, statusMessage: `Teknisi "${tech.name}" sudah ada di daftar upah ini` })
    }
    seen.add(tech.id)
    wages.push({ technicianId: tech.id, name: tech.name, amount, sortOrder: wages.length })
  }

  await db.transaction(async (tx) => {
    await tx.delete(schema.projectTechnicianWages).where(eq(schema.projectTechnicianWages.productId, id))
    if (!wages.length) return
    await tx.insert(schema.projectTechnicianWages).values(
      wages.map((row) => ({
        productId: id,
        technicianId: row.technicianId,
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
