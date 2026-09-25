import { asc, inArray } from 'drizzle-orm'
import { loadRabLines, withRabTotals } from './customOrders.js'
import { applyRabAdjustments, loadProjectExtraLines, loadProjectRabAdjustments } from './projectLines.js'
import { loadMaterialUsagesByProduct, materialUsageTotal } from './materialUsage.js'
import { parseConsumableLotSale } from './consumableLot.js'
import { loadProjectExpensesByProduct, sumProjectExpenses } from './projectExpenses.js'

function lineAmount(line) {
  return Math.round((Number(line.quantity) || 0) * (Number(line.salePrice) || 0))
}

function lineCost(line) {
  return Math.round((Number(line.quantity) || 0) * (Number(line.costPrice) || 0))
}

export function summarizeProjectRevenue(
  lines,
  wages,
  materialCost = 0,
  lotSale = 0,
  projectExpenses = 0,
  discountAmount = 0
) {
  let goodsSale = 0
  let goodsCost = 0
  let serviceSale = 0
  for (const line of lines || []) {
    const sale = lineAmount(line)
    const cost = lineCost(line)
    if (line.lineType === 'service') serviceSale += sale
    else {
      goodsSale += sale
      goodsCost += cost
    }
  }
  const supplies = Math.max(Math.round(Number(materialCost) || 0), 0)
  const lot = Math.max(Math.round(Number(lotSale) || 0), 0)
  goodsSale += lot
  goodsCost += supplies
  const wageTotal = (wages || []).reduce((sum, row) => sum + Math.max(Math.round(Number(row.amount) || 0), 0), 0)
  const expenseTotal = Array.isArray(projectExpenses)
    ? sumProjectExpenses(projectExpenses)
    : Math.max(Math.round(Number(projectExpenses) || 0), 0)
  const grossRevenue = goodsSale + serviceSale
  const discount = Math.min(Math.max(Math.round(Number(discountAmount) || 0), 0), grossRevenue)
  const revenue = grossRevenue - discount
  return {
    goodsSale,
    goodsCost,
    serviceSale,
    materialCost: supplies,
    lotSale: lot,
    netService: serviceSale - supplies,
    grossRevenue,
    discountAmount: discount,
    revenue,
    wageTotal,
    expenseTotal,
    profit: revenue - goodsCost - wageTotal - expenseTotal
  }
}

export function projectGrossRevenue(summary) {
  if (!summary) return 0
  const gross = Math.max(Math.round(Number(summary.grossRevenue) || 0), 0)
  if (gross) return gross
  return Math.max(Math.round(Number(summary.revenue) || 0), 0)
}

export function downPaymentTotal(rows) {
  return (rows || []).reduce((sum, row) => sum + Math.max(Math.round(Number(row.amount) || 0), 0), 0)
}

export async function loadUnsoldProjectDownPayments(db, schema) {
  const sold = await db.select({ productId: schema.sales.productId }).from(schema.sales)
  const soldIds = new Set(sold.map((row) => Number(row.productId)).filter(Boolean))
  const rows = await db.select({
    productId: schema.projectDownPayments.productId,
    amount: schema.projectDownPayments.amount
  }).from(schema.projectDownPayments)
  let total = 0
  for (const row of rows) {
    if (soldIds.has(Number(row.productId))) continue
    total += Math.max(Math.round(Number(row.amount) || 0), 0)
  }
  return total
}

export async function loadProjectFinanceMap(db, schema, productIds) {
  const ids = [...new Set((productIds || []).filter(Boolean))]
  const map = new Map(
    ids.map((id) => [
      id,
      {
        rab: null,
        extraLines: [],
        rabAdjustments: [],
        wages: [],
        downPayments: [],
        materialUsages: [],
        projectExpenses: [],
        summary: summarizeProjectRevenue([], [])
      }
    ])
  )
  if (!ids.length) return map

  const wageRows = await db
    .select()
    .from(schema.projectTechnicianWages)
    .where(inArray(schema.projectTechnicianWages.productId, ids))
    .orderBy(asc(schema.projectTechnicianWages.sortOrder), asc(schema.projectTechnicianWages.id))
  for (const row of wageRows) {
    map.get(row.productId)?.wages.push(row)
  }

  const usageMap = await loadMaterialUsagesByProduct(db, schema, ids)
  const extraMap = await loadProjectExtraLines(db, schema, ids)
  const adjMap = await loadProjectRabAdjustments(db, schema, ids)
  const expenseMap = await loadProjectExpensesByProduct(db, schema, ids)
  const saleRows = await db
    .select({
      productId: schema.sales.productId,
      discountAmount: schema.sales.discountAmount
    })
    .from(schema.sales)
    .where(inArray(schema.sales.productId, ids))
  const discountById = new Map()
  for (const row of saleRows) {
    const productId = Number(row.productId)
    if (!productId) continue
    discountById.set(
      productId,
      (discountById.get(productId) || 0) + Math.max(Math.round(Number(row.discountAmount) || 0), 0)
    )
  }
  const dpRows = await db
    .select()
    .from(schema.projectDownPayments)
    .where(inArray(schema.projectDownPayments.productId, ids))
    .orderBy(asc(schema.projectDownPayments.date), asc(schema.projectDownPayments.id))
  for (const row of dpRows) {
    map.get(row.productId)?.downPayments.push(row)
  }
  for (const id of ids) {
    const entry = map.get(id)
    if (!entry) continue
    entry.extraLines = extraMap.get(id) || []
    entry.rabAdjustments = adjMap.get(id) || []
    entry.materialUsages = usageMap.get(id) || []
    entry.projectExpenses = expenseMap.get(id) || []
  }

  const rabs = await db
    .select()
    .from(schema.customOrders)
    .where(inArray(schema.customOrders.projectId, ids))
  const lineMap = await loadRabLines(
    db,
    rabs.map((row) => row.id)
  )
  for (const rab of rabs) {
    const entry = map.get(rab.projectId)
    if (!entry) continue
    entry.rab = withRabTotals(rab, lineMap.get(rab.id) || [])
    entry.rab.lines = applyRabAdjustments(entry.rab.lines, entry.rabAdjustments)
  }

  const projectRows = await db
    .select({ id: schema.products.id, consumableLotSale: schema.products.consumableLotSale })
    .from(schema.products)
    .where(inArray(schema.products.id, ids))
  const lotSaleById = new Map(projectRows.map((row) => [row.id, parseConsumableLotSale(row.consumableLotSale)]))
  for (const [productId, entry] of map) {
    const rabLines = (entry.rab?.lines || []).map((line) => ({ ...line, source: line.source || 'rab' }))
    const supplies = materialUsageTotal(entry.materialUsages)
    entry.summary = summarizeProjectRevenue(
      [...rabLines, ...entry.extraLines],
      entry.wages,
      supplies,
      lotSaleById.get(productId) ?? parseConsumableLotSale(null),
      entry.projectExpenses,
      discountById.get(productId) || 0
    )
  }
  return map
}
