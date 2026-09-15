import { useDb, schema } from '../../db/index.js'
import { requireAdmin } from '../../utils/rbac.js'
import { logAudit } from '../../utils/audit.js'
import { parseJobType } from '../../utils/jobType.js'
import { sanitizeText } from '../../utils/sanitizeText.js'

export default defineEventHandler(async (event) => {
  requireAdmin(event)
  const body = await readBody(event)
  if (!body.name) throw createError({ statusCode: 400, statusMessage: 'Nama wajib diisi' })
  const seriesId = body.seriesId === '' || body.seriesId == null ? null : Number(body.seriesId)
  const customerName = sanitizeText(body.customerName || '') || null
  const db = useDb()
  const rows = await db
    .insert(schema.products)
    .values({
      name: body.name,
      description: body.description || null,
      customerName,
      status: 'waiting',
      jobType: parseJobType(body.jobType, { required: true }),
      seriesId: Number.isInteger(seriesId) && seriesId > 0 ? seriesId : null
    })
    .returning({
      id: schema.products.id,
      name: schema.products.name,
      status: schema.products.status,
      seriesId: schema.products.seriesId
    })
  await logAudit(event, { action: 'create', entity: 'product', entityId: rows[0].id, summary: `Tambah proyek "${rows[0].name}"` })
  return rows[0]
})
