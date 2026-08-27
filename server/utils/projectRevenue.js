import { asc, inArray } from 'drizzle-orm'
import { loadRabLines, withRabTotals } from './customOrders.js'

function lineAmount(line) {
  return Math.round((Number(line.quantity) || 0) * (Number(line.salePrice) || 0))
}

function lineCost(line) {
  return Math.round((Number(line.quantity) || 0) * (Number(line.costPrice) || 0))
}

export function summarizeProjectRevenue(lines, wages) {
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
  const wageTotal = (wages || []).reduce((sum, row) => sum + Math.max(Math.round(Number(row.amount) || 0), 0), 0)
  const revenue = goodsSale + serviceSale
  return {
    goodsSale,
    goodsCost,
    serviceSale,
    revenue,
    wageTotal,
    profit: revenue - goodsCost - wageTotal
  }
}

export async function loadProjectFinanceMap(db, schema, productIds) {
  const ids = [...new Set((productIds || []).filter(Boolean))]
  const map = new Map(
    ids.map((id) => [
      id,
      { rab: null, wages: [], summary: summarizeProjectRevenue([], []) }
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
  }

  for (const entry of map.values()) {
    entry.summary = summarizeProjectRevenue(entry.rab?.lines || [], entry.wages)
  }
  return map
}
