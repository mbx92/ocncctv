import { and, gte, lte, eq, sql } from 'drizzle-orm'
import { useDb, schema } from '../db/index.js'
import { loadCustomOrderHppMap } from './customOrders.js'
import { loadProjectFinanceMap } from './projectRevenue.js'
import { toDateStr } from './dates.js'
import { saleMoney } from './salePayment.js'

export async function attachSaleCogs(rows) {
  const db = useDb()
  const financeMap = await loadProjectFinanceMap(
    db,
    schema,
    rows.map((r) => r.productId)
  )
  const fallbackIds = rows
    .filter((r) => r.customOrderId && !financeMap.get(r.productId)?.rab)
    .map((r) => r.customOrderId)
  const customHpp = await loadCustomOrderHppMap(fallbackIds)

  return rows.map((r) => {
    const finance = r.productId ? financeMap.get(r.productId) : null
    let totalHpp = 0
    if (finance?.rab) totalHpp = finance.summary?.goodsCost ?? 0
    else if (r.customOrderId) totalHpp = customHpp.get(r.customOrderId)?.total ?? 0
    const qty = r.quantity || 0
    const hppPerUnit = qty ? Math.round(totalHpp / qty) : totalHpp
    return {
      ...r,
      hppPerUnit,
      totalHpp,
      netMargin: (r.netRevenue ?? 0) - totalHpp
    }
  })
}

export async function loadSalesWithHpp({ dateFrom, dateTo } = {}) {
  const db = useDb()
  const from = toDateStr(dateFrom)
  const to = toDateStr(dateTo)
  const conds = []
  if (from) conds.push(gte(schema.sales.date, from))
  if (to) conds.push(lte(schema.sales.date, to))

  const rows = await db
    .select({
      id: schema.sales.id,
      date: schema.sales.date,
      productId: schema.sales.productId,
      customOrderId: schema.sales.customOrderId,
      productName: sql`coalesce(${schema.products.name}, 'RAB · ' || ${schema.customOrders.customerName})`.as(
        'productName'
      ),
      quantity: schema.sales.quantity,
      salePricePerUnit: schema.sales.salePricePerUnit,
      channel: schema.sales.channel,
      marketplaceFeePercent: schema.sales.marketplaceFeePercent,
      discountAmount: schema.sales.discountAmount
    })
    .from(schema.sales)
    .leftJoin(schema.products, eq(schema.sales.productId, schema.products.id))
    .leftJoin(schema.customOrders, eq(schema.sales.customOrderId, schema.customOrders.id))
    .where(conds.length ? and(...conds) : undefined)

  return attachSaleCogs(
    rows.map((r) => {
      const money = saleMoney(r)
      return {
        ...r,
        date: toDateStr(r.date) || r.date,
        isCustom: !!r.customOrderId,
        netPricePerUnit: r.quantity ? Math.round(money.net / r.quantity) : 0,
        grossRevenue: money.gross,
        netRevenue: money.net,
        feeAmount: money.fee,
        discountAmount: money.discount
      }
    })
  )
}

export function marginPercent(margin, revenue) {
  return revenue ? Math.round((margin / revenue) * 100) : 0
}
