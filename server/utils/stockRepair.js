import { eq, sql } from 'drizzle-orm'
import { stockStatusFromQuantity } from './materialType.js'
import { createPurchaseLot } from './packagingLots.js'
import { localDateStr } from './dates.js'

function qtyOf(value) {
  return Math.max(Math.round(Number(value) || 0), 0)
}

function packagingMultiplier(item) {
  const n = qtyOf(item?.unitsPerPurchase)
  return n > 1 ? n : 1
}

function remainingOf(lot, moves) {
  const used = (moves || [])
    .filter((move) => move.lotId === lot.id)
    .reduce((sum, move) => sum + qtyOf(move.quantity), 0)
  return Math.max(qtyOf(lot.quantityIn) - used, 0)
}

export async function previewMaterialStockRepair(db, schema) {
  const [materials, usages, lines] = await Promise.all([
    db.select().from(schema.materials),
    db
      .select({
        materialId: schema.materialUsages.materialId,
        used: sql`coalesce(sum(${schema.materialUsages.quantity}), 0)`.mapWith(Number)
      })
      .from(schema.materialUsages)
      .groupBy(schema.materialUsages.materialId),
    db
      .select({
        materialId: schema.supplierPurchaseLines.materialId,
        purchasedIn: sql`coalesce(sum(${schema.supplierPurchaseLines.stockQuantity}), 0)`.mapWith(Number)
      })
      .from(schema.supplierPurchaseLines)
      .where(eq(schema.supplierPurchaseLines.itemType, 'material'))
      .groupBy(schema.supplierPurchaseLines.materialId)
  ])
  const usedMap = new Map(usages.map((row) => [row.materialId, qtyOf(row.used)]))
  const purchasedMap = new Map(lines.map((row) => [row.materialId, qtyOf(row.purchasedIn)]))

  return materials
    .map((row) => {
      const current = qtyOf(row.stockQuantity)
      const nextStock = current
      const nextStatus = stockStatusFromQuantity(nextStock, row.lowStockQuantity)
      const purchasedIn = purchasedMap.get(row.id) || 0
      const used = usedMap.get(row.id) || 0
      return {
        id: row.id,
        name: row.name,
        unit: row.unit,
        current,
        next: nextStock,
        purchasedIn,
        used,
        unrecorded: Math.max(purchasedIn - used - current, 0),
        currentStatus: row.stockStatus,
        nextStatus,
        changed: row.stockStatus !== nextStatus
      }
    })
    .sort((a, b) => a.name.localeCompare(b.name, 'id'))
}

export async function applyMaterialStockRepair(tx, schema) {
  const preview = await previewMaterialStockRepair(tx, schema)
  const changed = []
  for (const row of preview.filter((item) => item.changed)) {
    const [updated] = await tx
      .update(schema.materials)
      .set({
        stockQuantity: row.next,
        stockStatus: row.nextStatus
      })
      .where(eq(schema.materials.id, row.id))
      .returning({ id: schema.materials.id })
    if (updated) changed.push(row)
  }
  return { items: preview, changed }
}

export async function previewPackagingStockRepair(db, schema) {
  const [items, lots, moves, lines, purchases] = await Promise.all([
    db.select().from(schema.packaging),
    db.select().from(schema.packagingLots),
    db.select().from(schema.packagingLotMoves),
    db.select().from(schema.supplierPurchaseLines),
    db.select().from(schema.supplierPurchases)
  ])
  const purchaseMap = new Map(purchases.map((row) => [row.id, row]))
  const lotsByPackaging = new Map()
  for (const lot of lots) {
    const list = lotsByPackaging.get(lot.packagingId) || []
    list.push(lot)
    lotsByPackaging.set(lot.packagingId, list)
  }
  const lotByLine = new Map(lots.filter((lot) => lot.purchaseLineId).map((lot) => [lot.purchaseLineId, lot]))

  return items
    .map((item) => {
      const itemLots = lotsByPackaging.get(item.id) || []
      const remaining = itemLots.reduce((sum, lot) => sum + remainingOf(lot, moves), 0)
      const missingLots = lines.filter(
        (line) =>
          line.itemType === 'packaging' &&
          line.packagingId === item.id &&
          !lotByLine.has(line.id) &&
          purchaseMap.get(line.purchaseId)
      )
      const current = qtyOf(item.stockQuantity)
      const next = itemLots.length ? remaining : current
      const needsOpeningLot = !itemLots.length && current > 0
      return {
        id: item.id,
        name: item.name,
        unit: item.unit,
        current,
        next,
        remaining: itemLots.length ? remaining : current,
        missingLotCount: missingLots.length,
        needsOpeningLot,
        changed: current !== next || missingLots.length > 0 || needsOpeningLot
      }
    })
    .sort((a, b) => a.name.localeCompare(b.name, 'id'))
}

export async function applyPackagingStockRepair(tx, schema) {
  const [items, lots, lines, purchases] = await Promise.all([
    tx.select().from(schema.packaging),
    tx.select().from(schema.packagingLots),
    tx.select().from(schema.supplierPurchaseLines),
    tx.select().from(schema.supplierPurchases)
  ])
  const purchaseMap = new Map(purchases.map((row) => [row.id, row]))
  const lotByLine = new Map(lots.filter((lot) => lot.purchaseLineId).map((lot) => [lot.purchaseLineId, lot.id]))
  const hadLots = new Set(lots.map((lot) => lot.packagingId))

  let lotsCreated = 0
  for (const line of lines) {
    if (line.itemType !== 'packaging' || !line.packagingId || lotByLine.has(line.id)) continue
    const purchase = purchaseMap.get(line.purchaseId)
    const item = items.find((row) => row.id === line.packagingId)
    if (!purchase || !item) continue
    const multiplier = packagingMultiplier(item)
    const quantityIn = qtyOf(line.quantity) * multiplier
    const stockIn = qtyOf(line.stockQuantity) * multiplier
    await createPurchaseLot(tx, schema, {
      line: { ...line, itemType: 'packaging' },
      purchase,
      quantityIn,
      usedNow: Math.max(quantityIn - stockIn, 0)
    })
    lotsCreated += 1
  }

  const refreshedLots = await tx.select().from(schema.packagingLots)
  const refreshedMoves = await tx.select().from(schema.packagingLotMoves)
  const changed = []

  for (const item of items) {
    const itemLots = refreshedLots.filter((lot) => lot.packagingId === item.id)
    if (!itemLots.length && qtyOf(item.stockQuantity) > 0) {
      await tx.insert(schema.packagingLots).values({
        packagingId: item.id,
        originProjectId: null,
        purchaseLineId: null,
        source: 'opening',
        quantityIn: qtyOf(item.stockQuantity),
        receivedDate: localDateStr()
      })
      lotsCreated += 1
      continue
    }
    if (!itemLots.length || !hadLots.has(item.id)) continue
    const remaining = itemLots.reduce((sum, lot) => sum + remainingOf(lot, refreshedMoves), 0)
    if (qtyOf(item.stockQuantity) === remaining) continue
    await tx
      .update(schema.packaging)
      .set({ stockQuantity: remaining })
      .where(eq(schema.packaging.id, item.id))
    changed.push({
      id: item.id,
      name: item.name,
      unit: item.unit,
      current: qtyOf(item.stockQuantity),
      next: remaining
    })
  }

  const preview = await previewPackagingStockRepair(tx, schema)
  return { items: preview, changed, lotsCreated }
}
