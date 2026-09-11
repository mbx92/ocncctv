import { eq } from 'drizzle-orm'
import { useDb, schema } from '../../../db/index.js'
import { loadProjectFinanceMap } from '../../../utils/projectRevenue.js'

export default defineEventHandler(async (event) => {
  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id) || id <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'ID proyek tidak valid' })
  }
  const db = useDb()
  const [project] = await db.select({ id: schema.products.id, name: schema.products.name }).from(schema.products).where(eq(schema.products.id, id))
  if (!project) throw createError({ statusCode: 404, statusMessage: 'Proyek tidak ditemukan' })

  const financeMap = await loadProjectFinanceMap(db, schema, [id])
  const finance = financeMap.get(id)
  return {
    projectId: project.id,
    projectName: project.name,
    wages: finance?.wages || [],
    serviceSale: finance?.summary?.serviceSale ?? 0,
    wageTotal: finance?.summary?.wageTotal ?? 0
  }
})
