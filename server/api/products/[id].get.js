import { eq } from 'drizzle-orm'
import { useDb, schema } from '../../db/index.js'
import { getHppForProduct } from '../../utils/productHpp.js'
import { loadProjectFinanceMap } from '../../utils/projectRevenue.js'

export default defineEventHandler(async (event) => {
  const id = Number(getRouterParam(event, 'id'))
  const db = useDb()
  const rows = await db.select().from(schema.products).where(eq(schema.products.id, id))
  if (!rows.length) throw createError({ statusCode: 404, statusMessage: 'Proyek tidak ditemukan' })
  const hpp = await getHppForProduct(id)
  const images = await db
    .select()
    .from(schema.productImages)
    .where(eq(schema.productImages.productId, id))
    .orderBy(schema.productImages.sortOrder, schema.productImages.id)
  const financeMap = await loadProjectFinanceMap(db, schema, [id])
  const finance = financeMap.get(id)
  return {
    ...rows[0],
    images,
    rab: finance?.rab || null,
    extraLines: finance?.extraLines || [],
    rabAdjustments: finance?.rabAdjustments || [],
    wages: finance?.wages || [],
    finance: finance?.summary || null,
    hpp: hpp.total,
    breakdown: hpp.breakdown,
    materialLines: hpp.materialLines,
    packagingLines: hpp.packagingLines,
    recipes: hpp.recipeRows.map((r) => ({
      id: r.id,
      materialId: r.materialId,
      quantityUsed: r.quantityUsed,
      printTimeMinutes: r.printTimeMinutes,
      machineId: r.machineId,
      failureRatePercent: r.failureRatePercent,
      laborMinutes: r.laborMinutes,
      laborRatePerHour: r.laborRatePerHour
    })),
    packaging: hpp.packagingRows.map((p) => ({
      id: p.id,
      packagingId: p.packagingId,
      quantityUsed: p.quantityUsed
    }))
  }
})
