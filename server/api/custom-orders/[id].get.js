import { desc, eq } from 'drizzle-orm'
import { useDb, schema } from '../../db/index.js'
import { hppForCustomOrder, loadRabLines, withRabTotals } from '../../utils/customOrders.js'

export default defineEventHandler(async (event) => {
  const id = Number(getRouterParam(event, 'id'))
  const db = useDb()
  const [row] = await db.select().from(schema.customOrders).where(eq(schema.customOrders.id, id))
  if (!row) throw createError({ statusCode: 404, statusMessage: 'RAB tidak ditemukan' })

  const lineMap = await loadRabLines(db, [id])
  const lines = lineMap.get(id) || []
  const files = await db
    .select()
    .from(schema.customOrderFiles)
    .where(eq(schema.customOrderFiles.customOrderId, id))
    .orderBy(desc(schema.customOrderFiles.id))
  const hpp = await hppForCustomOrder(row, { lines })
  let project = null
  if (row.projectId) {
    const [p] = await db
      .select({ id: schema.products.id, name: schema.products.name, status: schema.products.status })
      .from(schema.products)
      .where(eq(schema.products.id, row.projectId))
    project = p || null
  }

  return withRabTotals(row, lines, {
    hpp: hpp.total,
    files,
    project
  })
})
