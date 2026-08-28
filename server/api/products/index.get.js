import { asc, eq } from 'drizzle-orm'
import { useDb, schema } from '../../db/index.js'
import { getHppForProducts } from '../../utils/productHpp.js'
import { loadProjectFinanceMap } from '../../utils/projectRevenue.js'

function presentProjectFinance(p, finance) {
  const summary = finance?.summary
  const scopeRevenue = summary?.revenue ?? 0
  const fallbackRevenue = Math.max(Math.round(Number(p.erpTotalValue) || 0), 0)
  const hasRab = !!finance?.rab
  const hasScope = hasRab || (finance?.extraLines?.length > 0) || fallbackRevenue > 0
  const revenue = scopeRevenue > 0 ? scopeRevenue : fallbackRevenue
  const wageTotal = summary?.wageTotal ?? 0
  const goodsCost = summary?.goodsCost ?? 0
  const profit = scopeRevenue > 0 ? (summary?.profit ?? 0) : fallbackRevenue - goodsCost - wageTotal

  return {
    hasRab,
    hasScope,
    rabId: finance?.rab?.id || null,
    customerName: finance?.rab?.customerName || p.customerName || null,
    goodsSale: summary?.goodsSale ?? 0,
    goodsCost,
    serviceSale: summary?.serviceSale ?? 0,
    revenue,
    profit,
    wageTotal
  }
}

export default defineEventHandler(async () => {
  const db = useDb()
  const products = await db.select().from(schema.products).orderBy(asc(schema.products.name))
  const ids = products.map((p) => p.id)
  const hppMap = await getHppForProducts(ids)
  const financeMap = await loadProjectFinanceMap(db, schema, ids)
  const soldIds = new Set()
  const soldByProduct = await db.select({ productId: schema.sales.productId }).from(schema.sales)
  for (const row of soldByProduct) if (row.productId) soldIds.add(row.productId)
  const soldByRab = await db
    .select({ projectId: schema.customOrders.projectId })
    .from(schema.sales)
    .innerJoin(schema.customOrders, eq(schema.sales.customOrderId, schema.customOrders.id))
  for (const row of soldByRab) if (row.projectId) soldIds.add(row.projectId)
  return products.map((p) => {
    const hpp = hppMap.get(p.id)
    const finance = financeMap.get(p.id)
    const financeView = presentProjectFinance(p, finance)
    const printMinutesPerUnit = (hpp?.recipeRows || []).reduce(
      (max, r) => Math.max(max, r.printTimeMinutes || 0),
      0
    )
    return {
      ...p,
      hpp: hpp?.total ?? 0,
      hasRecipe: (hpp?.recipeRows?.length ?? 0) > 0,
      printMinutesPerUnit,
      ...financeView,
      hasSale: soldIds.has(p.id)
    }
  })
})
