import { eq } from 'drizzle-orm'
import { useDb, schema } from '../../../db/index.js'
import { requireAdmin } from '../../../utils/rbac.js'
import { logAudit } from '../../../utils/audit.js'
import { normalizeProductStatus } from '../../../utils/projectStatus.js'
import { loadRabLines } from '../../../utils/customOrders.js'
import {
  loadProjectExtraLines,
  loadProjectRabAdjustments,
  parseRabAdjustments,
  replaceProjectExtraLines,
  replaceProjectRabAdjustments
} from '../../../utils/projectLines.js'

export default defineEventHandler(async (event) => {
  requireAdmin(event)
  const id = Number(getRouterParam(event, 'id'))
  const body = await readBody(event)
  const db = useDb()
  const [product] = await db.select().from(schema.products).where(eq(schema.products.id, id))
  if (!product) throw createError({ statusCode: 404, statusMessage: 'Proyek tidak ditemukan' })
  if (normalizeProductStatus(product.status) === 'done') {
    throw createError({ statusCode: 400, statusMessage: 'Proyek yang sudah selesai tidak bisa diubah itemnya' })
  }

  const [rab] = await db
    .select({ id: schema.customOrders.id })
    .from(schema.customOrders)
    .where(eq(schema.customOrders.projectId, id))
  const rabLineMap = rab ? await loadRabLines(db, [rab.id]) : new Map()
  const rabLines = rab ? rabLineMap.get(rab.id) || [] : []
  const adjustments = parseRabAdjustments(body?.adjustments, rabLines)
  const lines = Array.isArray(body?.lines) ? body.lines : []

  await db.transaction(async (tx) => {
    await replaceProjectExtraLines(tx, schema, id, lines)
    await replaceProjectRabAdjustments(tx, schema, id, adjustments)
  })
  await logAudit(event, {
    action: 'update',
    entity: 'product',
    entityId: id,
    summary: `Ubah lingkup proyek "${product.name}" (${lines.length} tambahan, ${adjustments.length} pengurangan RAB)`
  })
  const extraMap = await loadProjectExtraLines(db, schema, [id])
  const adjMap = await loadProjectRabAdjustments(db, schema, [id])
  return {
    ok: true,
    extraLines: extraMap.get(id) || [],
    rabAdjustments: adjMap.get(id) || []
  }
})
