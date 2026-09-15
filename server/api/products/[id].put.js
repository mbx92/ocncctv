import { eq } from 'drizzle-orm'
import { useDb, schema } from '../../db/index.js'
import { requireAdmin } from '../../utils/rbac.js'
import { logAudit } from '../../utils/audit.js'
import { parseJobType } from '../../utils/jobType.js'
import { sanitizeText } from '../../utils/sanitizeText.js'

export default defineEventHandler(async (event) => {
  requireAdmin(event)
  const id = Number(getRouterParam(event, 'id'))
  const body = await readBody(event)
  const db = useDb()
  const patch = {
    name: body.name,
    description: body.description || null
  }
  let customerName
  if ('customerName' in body) {
    customerName = sanitizeText(body.customerName || '') || null
    if (!customerName) {
      const linkedRab = await db
        .select({ id: schema.customOrders.id })
        .from(schema.customOrders)
        .where(eq(schema.customOrders.projectId, id))
        .limit(1)
      if (linkedRab.length) {
        throw createError({
          statusCode: 400,
          statusMessage: 'Nama pelanggan wajib karena proyek sudah punya RAB'
        })
      }
    }
    patch.customerName = customerName
  }
  if ('jobType' in body) {
    patch.jobType = parseJobType(body.jobType)
  }
  if ('seriesId' in body) {
    const seriesId = body.seriesId === '' || body.seriesId == null ? null : Number(body.seriesId)
    patch.seriesId = Number.isInteger(seriesId) && seriesId > 0 ? seriesId : null
  }
  if (body.stockQuantity !== undefined && body.stockQuantity !== '') {
    patch.stockQuantity = Math.max(Math.round(Number(body.stockQuantity) || 0), 0)
  }
  const rows = await db
    .update(schema.products)
    .set(patch)
    .where(eq(schema.products.id, id))
    .returning()
  if (!rows.length) throw createError({ statusCode: 404, statusMessage: 'Proyek tidak ditemukan' })
  if (customerName) {
    await db
      .update(schema.customOrders)
      .set({ customerName })
      .where(eq(schema.customOrders.projectId, id))
  }
  await logAudit(event, { action: 'update', entity: 'product', entityId: id, summary: `Ubah info proyek "${rows[0].name}"` })
  return rows[0]
})
