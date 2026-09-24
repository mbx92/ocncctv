import { desc, eq, inArray, sql } from 'drizzle-orm'

function qtyOf(value) {
  return Math.max(Math.round(Number(value) || 0), 0)
}

export function lotCode(id) {
  return `LOT-${id}`
}

export async function loadPackagingLots(db, schema, { packagingId, projectId } = {}) {
  const lots = await db.select().from(schema.packagingLots).orderBy(desc(schema.packagingLots.receivedDate), desc(schema.packagingLots.id))
  const filtered = lots.filter((lot) => {
    if (packagingId && lot.packagingId !== packagingId) return false
    return true
  })
  if (!filtered.length) return []
  const ids = filtered.map((lot) => lot.id)
  const [moves, packagingRows, projectRows] = await Promise.all([
    db.select().from(schema.packagingLotMoves).where(inArray(schema.packagingLotMoves.lotId, ids)),
    db.select({ id: schema.packaging.id, name: schema.packaging.name, unit: schema.packaging.unit }).from(schema.packaging),
    db.select({ id: schema.products.id, name: schema.products.name }).from(schema.products)
  ])
  const packagingMap = new Map(packagingRows.map((row) => [row.id, row]))
  const projectMap = new Map(projectRows.map((row) => [row.id, row.name]))
  return filtered
    .map((lot) => {
      const lotMoves = moves
        .filter((move) => move.lotId === lot.id)
        .sort((a, b) => String(b.date).localeCompare(String(a.date)) || b.id - a.id)
      const used = lotMoves.reduce((sum, move) => sum + qtyOf(move.quantity), 0)
      const item = packagingMap.get(lot.packagingId)
      return {
        ...lot,
        code: lotCode(lot.id),
        packagingName: item?.name || '',
        unit: item?.unit || '',
        originProjectName: lot.originProjectId ? projectMap.get(lot.originProjectId) || '' : '',
        used,
        remaining: qtyOf(lot.quantityIn) - used,
        moves: lotMoves.map((move) => ({
          ...move,
          projectName: move.projectId ? projectMap.get(move.projectId) || '' : ''
        }))
      }
    })
    .filter((lot) => {
      if (!projectId) return true
      return lot.originProjectId === projectId || lot.moves.some((move) => move.projectId === projectId)
    })
}

export async function createPurchaseLot(tx, schema, { line, purchase, quantityIn, usedNow }) {
  if (!line?.id || line.itemType !== 'packaging' || !line.packagingId) return null
  quantityIn = qtyOf(quantityIn)
  usedNow = qtyOf(usedNow)
  const [lot] = await tx
    .insert(schema.packagingLots)
    .values({
      packagingId: line.packagingId,
      originProjectId: purchase.projectId || null,
      purchaseLineId: line.id,
      source: 'purchase',
      quantityIn,
      receivedDate: purchase.date
    })
    .returning()
  if (usedNow > 0) {
    await tx.insert(schema.packagingLotMoves).values({
      lotId: lot.id,
      projectId: purchase.projectId || null,
      quantity: usedNow,
      date: purchase.date,
      affectsStock: false
    })
  }
  return lot
}

export async function assertLotCanBeRebuilt(tx, schema, purchaseLineId) {
  const [lot] = await tx.select().from(schema.packagingLots).where(eq(schema.packagingLots.purchaseLineId, purchaseLineId))
  if (!lot) return
  const moves = await tx.select().from(schema.packagingLotMoves).where(eq(schema.packagingLotMoves.lotId, lot.id))
  if (moves.some((move) => move.affectsStock)) {
    throw createError({
      statusCode: 409,
      statusMessage: `Lot ${lotCode(lot.id)} sudah dipakai proyek lain. Batalkan pemakaian sisa itu dulu.`
    })
  }
}

export async function deletePurchaseLot(tx, schema, purchaseLineId) {
  const [lot] = await tx.select().from(schema.packagingLots).where(eq(schema.packagingLots.purchaseLineId, purchaseLineId))
  if (!lot) return
  await tx.delete(schema.packagingLots).where(eq(schema.packagingLots.id, lot.id))
}

export async function usePackagingLot(tx, schema, { lotId, projectId, quantity, date }) {
  const qty = qtyOf(quantity)
  if (!qty) throw createError({ statusCode: 400, statusMessage: 'Qty pemakaian wajib diisi' })
  if (!projectId) throw createError({ statusCode: 400, statusMessage: 'Pilih proyek' })
  const [project] = await tx.select({ id: schema.products.id, name: schema.products.name }).from(schema.products).where(eq(schema.products.id, projectId))
  if (!project) throw createError({ statusCode: 404, statusMessage: 'Proyek tidak ditemukan' })
  const [lot] = await tx.select().from(schema.packagingLots).where(eq(schema.packagingLots.id, lotId))
  if (!lot) throw createError({ statusCode: 404, statusMessage: 'Lot stok tidak ditemukan' })
  const [usedRow] = await tx
    .select({ total: sql`coalesce(sum(${schema.packagingLotMoves.quantity}), 0)`.mapWith(Number) })
    .from(schema.packagingLotMoves)
    .where(eq(schema.packagingLotMoves.lotId, lotId))
  const remaining = qtyOf(lot.quantityIn) - qtyOf(usedRow?.total)
  if (qty > remaining) {
    throw createError({ statusCode: 400, statusMessage: `Sisa lot ${lotCode(lot.id)} hanya ${remaining}` })
  }
  const [item] = await tx.select().from(schema.packaging).where(eq(schema.packaging.id, lot.packagingId))
  if (!item || qtyOf(item.stockQuantity) < qty) {
    throw createError({ statusCode: 400, statusMessage: `Stok "${item?.name || 'produk'}" tidak cukup` })
  }
  const [move] = await tx
    .insert(schema.packagingLotMoves)
    .values({
      lotId,
      projectId,
      quantity: qty,
      date,
      affectsStock: true
    })
    .returning()
  await tx
    .update(schema.packaging)
    .set({ stockQuantity: sql`${schema.packaging.stockQuantity} - ${qty}` })
    .where(eq(schema.packaging.id, lot.packagingId))
  return { move, lot, project, item }
}

export async function undoPackagingLotMove(tx, schema, moveId) {
  const [move] = await tx.select().from(schema.packagingLotMoves).where(eq(schema.packagingLotMoves.id, moveId))
  if (!move) throw createError({ statusCode: 404, statusMessage: 'Pergerakan tidak ditemukan' })
  if (!move.affectsStock) {
    throw createError({
      statusCode: 409,
      statusMessage: 'Pemakaian ini bagian dari pembelian. Ubah lewat dokumen pembelian.'
    })
  }
  const [lot] = await tx.select().from(schema.packagingLots).where(eq(schema.packagingLots.id, move.lotId))
  await tx.delete(schema.packagingLotMoves).where(eq(schema.packagingLotMoves.id, moveId))
  if (lot) {
    await tx
      .update(schema.packaging)
      .set({ stockQuantity: sql`${schema.packaging.stockQuantity} + ${qtyOf(move.quantity)}` })
      .where(eq(schema.packaging.id, lot.packagingId))
  }
  return { move, lot }
}
