import { asc, eq, inArray } from 'drizzle-orm'
import { useDb, schema } from '../db/index.js'
import { computeHpp } from './hpp.js'
import { getSettings } from './settings.js'
import { catalogDisplayName } from './catalogName.js'

export const RAB_OPEN_STATUSES = ['draft', 'sent', 'open', 'ready']
export const RAB_LOCKED_STATUSES = ['deal', 'lost', 'delivered', 'cancelled']

export function rabIsLocked(status) {
  return RAB_LOCKED_STATUSES.includes(String(status || ''))
}

export function totalsFromLines(lines) {
  let totalSale = 0
  let totalCost = 0
  for (const line of lines || []) {
    const qty = Number(line.quantity) || 0
    totalSale += Math.round(qty * (Number(line.salePrice) || 0))
    totalCost += Math.round(qty * (Number(line.costPrice) || 0))
  }
  return { totalSale, totalCost, margin: totalSale - totalCost }
}

export function parseRabLines(raw) {
  const list = Array.isArray(raw) ? raw : []
  return list.map((line, i) => {
    const lineType =
      line.lineType === 'service' ? 'service' : line.lineType === 'product' ? 'product' : 'catalog'
    const name = String(line.name || '').trim()
    if (!name) {
      throw createError({ statusCode: 400, statusMessage: `Nama baris ${i + 1} wajib diisi` })
    }
    const quantity = Math.max(Math.round(Number(line.quantity) || 0), 0)
    if (quantity <= 0) {
      throw createError({ statusCode: 400, statusMessage: `Qty baris ${i + 1} wajib lebih dari 0` })
    }
    const catalogItemId = Number(line.catalogItemId)
    const serviceId = Number(line.serviceId)
    const packagingId = Number(line.packagingId)
    const unit = String(line.unit || '').trim() || (lineType === 'service' ? 'titik' : 'pcs')
    if (lineType === 'product' && !(Number.isInteger(packagingId) && packagingId > 0)) {
      throw createError({
        statusCode: 400,
        statusMessage: `Baris ${i + 1}: pilih produk stok yang valid`
      })
    }
    return {
      lineType,
      catalogItemId:
        lineType === 'catalog' && Number.isInteger(catalogItemId) && catalogItemId > 0
          ? catalogItemId
          : null,
      serviceId:
        lineType === 'service' && Number.isInteger(serviceId) && serviceId > 0 ? serviceId : null,
      packagingId:
        lineType === 'product' && Number.isInteger(packagingId) && packagingId > 0 ? packagingId : null,
      name,
      code: String(line.code || '').trim() || null,
      unit,
      quantity,
      costPrice: lineType === 'service' ? 0 : Math.max(Math.round(Number(line.costPrice) || 0), 0),
      salePrice: Math.max(Math.round(Number(line.salePrice) || 0), 0),
      sortOrder: i
    }
  })
}

export function parseCustomOrderBody(body, { allowEmptyLines = false } = {}) {
  if (!body.date || !String(body.customerName || '').trim() || !String(body.title || '').trim()) {
    throw createError({ statusCode: 400, statusMessage: 'Tanggal, nama pelanggan, dan judul wajib diisi' })
  }
  const hasLines = Array.isArray(body.lines)
  const lines = hasLines ? parseRabLines(body.lines) : null
  if (hasLines && !allowEmptyLines && !lines.length) {
    throw createError({ statusCode: 400, statusMessage: 'Minimal satu baris produk atau jasa' })
  }
  const totals = totalsFromLines(lines || [])
  const machineId = body.machineId ? Number(body.machineId) : null
  const packagingId = body.packagingId ? Number(body.packagingId) : null
  const materialId = body.materialId ? Number(body.materialId) : null
  const header = {
    date: body.date,
    customerName: String(body.customerName).trim(),
    title: String(body.title).trim(),
    quantity: 1,
    materialId: Number.isInteger(materialId) && materialId > 0 ? materialId : null,
    materialQuantityUsed: Math.max(Number(body.materialQuantityUsed) || 0, 0),
    packagingId: Number.isInteger(packagingId) && packagingId > 0 ? packagingId : null,
    packagingQuantityUsed: Math.max(Number(body.packagingQuantityUsed) || 0, 0),
    machineId: Number.isInteger(machineId) && machineId > 0 ? machineId : null,
    printTimeMinutes: Math.max(Math.round(Number(body.printTimeMinutes) || 0), 0),
    notes: body.notes || null
  }
  if (hasLines) header.pricePerUnit = totals.totalSale
  return { header, lines, totals }
}

export async function replaceRabLines(tx, orderId, lines) {
  await tx.delete(schema.customOrderLines).where(eq(schema.customOrderLines.customOrderId, orderId))
  if (!lines.length) return
  await tx.insert(schema.customOrderLines).values(
    lines.map((line, i) => ({
      customOrderId: orderId,
      lineType: line.lineType,
      catalogItemId: line.catalogItemId,
      serviceId: line.serviceId,
      packagingId: line.packagingId,
      name: line.name,
      code: line.code,
      unit: line.unit || null,
      quantity: line.quantity,
      costPrice: line.costPrice,
      salePrice: line.salePrice,
      sortOrder: i
    }))
  )
}

export async function loadRabLines(db, orderIds) {
  const ids = [...new Set((orderIds || []).filter(Boolean))]
  const map = new Map(ids.map((id) => [id, []]))
  if (!ids.length) return map
  const rows = await db
    .select({
      line: schema.customOrderLines,
      catalogName: schema.supplierCatalogItems.name,
      catalogSheetLabel: schema.supplierCatalogItems.sheetLabel,
      catalogUnit: schema.supplierCatalogItems.unit,
      packagingName: schema.packaging.name,
      packagingUnit: schema.packaging.unit,
      packagingStock: schema.packaging.stockQuantity
    })
    .from(schema.customOrderLines)
    .leftJoin(
      schema.supplierCatalogItems,
      eq(schema.customOrderLines.catalogItemId, schema.supplierCatalogItems.id)
    )
    .leftJoin(schema.packaging, eq(schema.customOrderLines.packagingId, schema.packaging.id))
    .where(inArray(schema.customOrderLines.customOrderId, ids))
    .orderBy(asc(schema.customOrderLines.sortOrder), asc(schema.customOrderLines.id))
  for (const row of rows) {
    const list = map.get(row.line.customOrderId) || []
    list.push({
      ...row.line,
      catalogName: row.catalogName,
      catalogSheetLabel: row.catalogSheetLabel,
      catalogUnit: row.catalogUnit,
      packagingName: row.packagingName,
      packagingUnit: row.packagingUnit,
      packagingStock: row.packagingStock
    })
    map.set(row.line.customOrderId, list)
  }
  return map
}

export function presentRabLines(lines) {
  return (lines || []).map((line) =>
    presentRabLine(line, {
      catalogName: line.catalogName,
      catalogSheetLabel: line.catalogSheetLabel,
      catalogUnit: line.catalogUnit,
      packagingName: line.packagingName,
      packagingUnit: line.packagingUnit,
      packagingStock: line.packagingStock ?? line.stockQuantity
    })
  )
}

export function presentRabLine(line, extra = {}) {
  if (line.lineType === 'service') {
    return { ...line, unit: line.unit || 'titik' }
  }
  if (line.lineType === 'product') {
    return {
      ...line,
      name: extra.packagingName || line.name,
      unit: line.unit || extra.packagingUnit || 'pcs',
      stockQuantity: extra.packagingStock ?? null
    }
  }
  return {
    ...line,
    name: catalogDisplayName({
      name: extra.catalogName || line.name,
      sheetLabel: extra.catalogSheetLabel
    }),
    unit: line.unit || extra.catalogUnit || 'pcs'
  }
}

export function withRabTotals(order, lines, extra = {}) {
  const presented = presentRabLines(lines)
  const totals = totalsFromLines(presented)
  if (!presented.length && Number(order.pricePerUnit)) {
    return {
      ...order,
      lines: presented,
      totalSale: Number(order.pricePerUnit) || 0,
      totalCost: 0,
      margin: Number(order.pricePerUnit) || 0,
      ...extra
    }
  }
  return { ...order, lines: presented, ...totals, ...extra }
}

export function productionValuesFromOrder(order, extra = {}) {
  const planned = extra.quantityPlanned || order.quantity
  return {
    date: extra.date || order.date,
    productId: null,
    customOrderId: order.id,
    machineId: extra.machineId !== undefined ? extra.machineId : order.machineId,
    quantityPlanned: planned,
    quantityGood: extra.quantityGood ?? 0,
    quantityFailed: extra.quantityFailed ?? 0,
    status: extra.status || 'queued',
    notes: extra.notes !== undefined ? extra.notes : order.notes,
    stockApplied: extra.status === 'done',
    durationMinutes: (order.printTimeMinutes || 0) * planned
  }
}

function hppFromLineTotals(totalCost) {
  return {
    total: totalCost,
    breakdown: {
      materialCost: totalCost,
      failureBuffer: 0,
      electricityCost: 0,
      depreciationCost: 0,
      laborCost: 0,
      packagingCost: 0
    },
    materialLines: [],
    packagingLines: []
  }
}

export async function hppForCustomOrder(order, { material, machine, packaging, lines } = {}) {
  if (lines?.length) return hppFromLineTotals(totalsFromLines(lines).totalCost)
  const settings = await getSettings()
  return computeHpp(
    [
      {
        materialId: order.materialId,
        quantityUsed: Number(order.materialQuantityUsed) || 0,
        printTimeMinutes: order.printTimeMinutes || 0,
        machineId: order.machineId,
        failureRatePercent: 0,
        laborMinutes: 0,
        laborRatePerHour: 0,
        material: material || null,
        machine: machine || null
      }
    ],
    order.packagingId
      ? [
          {
            packagingId: order.packagingId,
            quantityUsed: Number(order.packagingQuantityUsed) || 0,
            packaging: packaging || null
          }
        ]
      : [],
    settings
  )
}

export async function loadCustomOrderHppMap(orderIds) {
  const map = new Map()
  const ids = [...new Set(orderIds.filter(Boolean))]
  if (!ids.length) return map
  const db = useDb()
  const lineMap = await loadRabLines(db, ids)
  const settings = await getSettings()
  for (const id of ids) {
    const lines = lineMap.get(id) || []
    if (lines.length) {
      map.set(id, hppFromLineTotals(totalsFromLines(lines).totalCost))
      continue
    }
    const [row] = await db
      .select({
        order: schema.customOrders,
        material: schema.materials,
        machine: schema.machines,
        packaging: schema.packaging
      })
      .from(schema.customOrders)
      .leftJoin(schema.materials, eq(schema.customOrders.materialId, schema.materials.id))
      .leftJoin(schema.machines, eq(schema.customOrders.machineId, schema.machines.id))
      .leftJoin(schema.packaging, eq(schema.customOrders.packagingId, schema.packaging.id))
      .where(eq(schema.customOrders.id, id))
    if (!row) continue
    map.set(
      id,
      computeHpp(
        [
          {
            materialId: row.order.materialId,
            quantityUsed: Number(row.order.materialQuantityUsed) || 0,
            printTimeMinutes: row.order.printTimeMinutes || 0,
            machineId: row.order.machineId,
            failureRatePercent: 0,
            laborMinutes: 0,
            laborRatePerHour: 0,
            material: row.material,
            machine: row.machine
          }
        ],
        row.order.packagingId
          ? [
              {
                packagingId: row.order.packagingId,
                quantityUsed: Number(row.order.packagingQuantityUsed) || 0,
                packaging: row.packaging
              }
            ]
          : [],
        settings
      )
    )
  }
  return map
}
