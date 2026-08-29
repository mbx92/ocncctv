import { eq } from 'drizzle-orm'
import { useDb, schema } from '../../../db/index.js'
import { logAudit } from '../../../utils/audit.js'
import { loadRabLines, RAB_OPEN_STATUSES, withRabTotals } from '../../../utils/customOrders.js'

export default defineEventHandler(async (event) => {
  const id = Number(getRouterParam(event, 'id'))
  const db = useDb()
  try {
    const { order, project } = await db.transaction(async (tx) => {
      const [existing] = await tx.select().from(schema.customOrders).where(eq(schema.customOrders.id, id))
      if (!existing) throw createError({ statusCode: 404, statusMessage: 'RAB tidak ditemukan' })
      if (existing.projectId || existing.status === 'deal') {
        throw createError({ statusCode: 400, statusMessage: 'RAB ini sudah menjadi proyek' })
      }
      if (!RAB_OPEN_STATUSES.includes(existing.status)) {
        throw createError({ statusCode: 400, statusMessage: 'Hanya RAB Draft atau Dikirim yang bisa Deal' })
      }
      const lineMap = await loadRabLines(tx, [id])
      const lines = lineMap.get(id) || []
      if (!lines.length) {
        throw createError({ statusCode: 400, statusMessage: 'Isi minimal satu baris sebelum Deal' })
      }
      const description = [existing.customerName, existing.notes].filter(Boolean).join(' · ') || null
      const [created] = await tx
        .insert(schema.products)
        .values({
          name: existing.title,
          description,
          customerName: existing.customerName,
          status: 'waiting'
        })
        .returning()
      const [updated] = await tx
        .update(schema.customOrders)
        .set({ status: 'deal', projectId: created.id })
        .where(eq(schema.customOrders.id, id))
        .returning()
      return { order: updated, project: created }
    })
    await logAudit(event, {
      action: 'update',
      entity: 'custom_order',
      entityId: id,
      summary: `RAB "${order.title}" Deal → proyek "${project.name}"`
    })
    await logAudit(event, {
      action: 'create',
      entity: 'product',
      entityId: project.id,
      summary: `Proyek "${project.name}" dari RAB ${id}`
    })
    const lineMap = await loadRabLines(db, [id])
    return withRabTotals(order, lineMap.get(id) || [], {
      project: { id: project.id, name: project.name, status: project.status }
    })
  } catch (e) {
    if (e?.statusCode) throw e
    throw createError({
      statusCode: 500,
      statusMessage: e?.message || 'Gagal Deal RAB'
    })
  }
})
