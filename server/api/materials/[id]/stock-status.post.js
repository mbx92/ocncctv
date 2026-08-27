import { eq } from 'drizzle-orm'
import { useDb, schema } from '../../../db/index.js'
import { requireAdmin } from '../../../utils/rbac.js'
import { logAudit } from '../../../utils/audit.js'
import { parseStockStatus } from '../../../utils/materialType.js'

const LABELS = { ok: 'Ada', low: 'Menipis', empty: 'Habis' }

export default defineEventHandler(async (event) => {
  requireAdmin(event)
  const id = Number(getRouterParam(event, 'id'))
  const body = await readBody(event)
  const stockStatus = parseStockStatus(body.status ?? body.stockStatus, '')
  if (!stockStatus) throw createError({ statusCode: 400, statusMessage: 'Status tidak valid' })
  const db = useDb()
  const rows = await db
    .update(schema.materials)
    .set({ stockStatus })
    .where(eq(schema.materials.id, id))
    .returning()
  if (!rows.length) throw createError({ statusCode: 404, statusMessage: 'Perlengkapan tidak ditemukan' })
  await logAudit(event, {
    action: 'update',
    entity: 'material',
    entityId: id,
    summary: `Status "${rows[0].name}": ${LABELS[stockStatus]}`
  })
  return rows[0]
})
