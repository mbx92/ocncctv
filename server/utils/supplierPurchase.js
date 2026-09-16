import { eq, sql } from 'drizzle-orm'
import { assertExpenseCategory } from './expenseCategory.js'
import { setExpenseProducts } from './expenseProducts.js'
import { applyMaterialStockDelta } from './materialStock.js'
import { sanitizeText } from './sanitizeText.js'
import { isMeterUnit, parseMetersPerRoll, purchaseStockMultiplier } from './cableRoll.js'

function lineAmount(qty, unitPrice) {
  return Math.round((Number(qty) || 0) * (Number(unitPrice) || 0))
}

function extraFees(body) {
  return {
    shippingFee: Math.max(Math.round(Number(body.shippingFee) || 0), 0),
    platformFee: Math.max(Math.round(Number(body.platformFee) || 0), 0)
  }
}

function landedUnitPrices(lines, extras) {
  const amounts = lines.map((l) => lineAmount(l.quantity, l.unitPrice))
  const goods = amounts.reduce((a, b) => a + b, 0)
  if (!goods || extras <= 0) {
    return lines.map((l, i) => ({ ...l, landedUnit: l.unitPrice, extraShare: 0, goodsAmount: amounts[i] }))
  }
  let allocated = 0
  return lines.map((l, i) => {
    const share = i === lines.length - 1 ? extras - allocated : Math.round((extras * amounts[i]) / goods)
    allocated += share
    const landedAmount = amounts[i] + share
    const qty = Number(l.quantity) || 0
    return {
      ...l,
      extraShare: share,
      goodsAmount: amounts[i],
      landedUnit: qty > 0 ? Math.round(landedAmount / qty) : l.unitPrice
    }
  })
}

export function parsePurchaseQty(value) {
  return Math.max(Math.round(Number(value) || 0), 0)
}

function parseStockQuantity(line, quantity) {
  if (line.stockQuantity === undefined || line.stockQuantity === null || line.stockQuantity === '') {
    return quantity
  }
  const stock = Number(line.stockQuantity) || 0
  if (stock < 0) {
    throw createError({ statusCode: 400, statusMessage: 'Qty masuk stok tidak boleh negatif' })
  }
  if (stock > quantity) {
    throw createError({ statusCode: 400, statusMessage: 'Qty masuk stok tidak boleh lebih dari qty beli' })
  }
  return Math.max(Math.round(stock), 0)
}

export function parsePurchaseBody(body) {
  const supplier = sanitizeText(body.supplier || '')
  const notes = body.notes ? sanitizeText(body.notes) || null : null
  if (!body.date || !supplier) {
    throw createError({ statusCode: 400, statusMessage: 'Tanggal dan supplier wajib diisi' })
  }
  const rawLines = Array.isArray(body.lines) ? body.lines : []
  const lines = rawLines
    .map((l) => {
      const quantity = parsePurchaseQty(l.quantity)
      return {
        itemType: l.itemType === 'packaging' ? 'packaging' : 'material',
        materialId: l.itemType === 'packaging' ? null : Number(l.materialId) || null,
        packagingId: l.itemType === 'packaging' ? Number(l.packagingId) || null : null,
        quantity,
        stockQuantity: Math.min(parseStockQuantity(l, quantity), quantity),
        unitPrice: Math.round(Number(l.unitPrice) || 0)
      }
    })
    .filter(
      (l) =>
        l.quantity > 0 &&
        ((l.itemType === 'material' && l.materialId) || (l.itemType === 'packaging' && l.packagingId))
    )

  if (!lines.length) throw createError({ statusCode: 400, statusMessage: 'Minimal satu baris barang dengan qty > 0' })

  const projectIdRaw = Number(body.projectId)
  const projectId = Number.isInteger(projectIdRaw) && projectIdRaw > 0 ? projectIdRaw : null

  const { shippingFee, platformFee } = extraFees(body)
  const extras = shippingFee + platformFee
  const goodsTotal = lines.reduce((a, l) => a + lineAmount(l.quantity, l.unitPrice), 0)
  const totalAmount = goodsTotal + extras
  const priced = landedUnitPrices(lines, extras)

  return {
    date: body.date,
    supplier,
    notes,
    projectId,
    shippingFee,
    platformFee,
    extras,
    totalAmount,
    lines,
    priced,
    category: String(body.category || '').trim()
  }
}

async function assertProject(tx, schema, projectId) {
  if (!projectId) return
  const [project] = await tx
    .select({ id: schema.products.id })
    .from(schema.products)
    .where(eq(schema.products.id, projectId))
  if (!project) throw createError({ statusCode: 400, statusMessage: 'Proyek tidak ditemukan' })
}

function packagingMeterMultiplier(packaging) {
  const stored = purchaseStockMultiplier(packaging)
  if (stored > 1) return stored
  if (isMeterUnit(packaging?.unit)) return 1
  const parsed = parseMetersPerRoll(packaging)
  return parsed > 1 ? parsed : 1
}

function packagingStockDelta(packaging, stockQuantity) {
  const qty = Math.max(Math.round(Number(stockQuantity) || 0), 0)
  return qty * packagingMeterMultiplier(packaging)
}

async function loadPackagingRow(tx, schema, packagingId) {
  const [row] = await tx.select().from(schema.packaging).where(eq(schema.packaging.id, packagingId))
  return row || null
}

export async function revertPurchaseLineStock(tx, schema, line) {
  const raw = Number(line.stockQuantity ?? line.quantity) || 0
  if (!raw) return
  if (line.itemType === 'material' && line.materialId) {
    await applyMaterialStockDelta(tx, schema, { id: line.materialId, delta: -raw })
    return
  }
  if (line.itemType === 'packaging' && line.packagingId) {
    const packaging = await loadPackagingRow(tx, schema, line.packagingId)
    const delta = packagingStockDelta(packaging, raw)
    await tx
      .update(schema.packaging)
      .set({ stockQuantity: sql`GREATEST(${schema.packaging.stockQuantity} - ${delta}, 0)` })
      .where(eq(schema.packaging.id, line.packagingId))
  }
}

async function insertPricedLines(tx, schema, purchaseId, priced) {
  const names = []
  for (const line of priced) {
    const amount = lineAmount(line.quantity, line.unitPrice)
    await tx.insert(schema.supplierPurchaseLines).values({
      purchaseId,
      itemType: line.itemType,
      materialId: line.materialId,
      packagingId: line.packagingId,
      quantity: line.quantity,
      stockQuantity: line.stockQuantity,
      unitPrice: line.unitPrice,
      amount
    })

    if (line.itemType === 'material') {
      let row
      if (line.stockQuantity > 0) {
        row = await applyMaterialStockDelta(tx, schema, {
          id: line.materialId,
          delta: line.stockQuantity,
          pricePerUnit: line.landedUnit
        })
      } else {
        const [found] = await tx
          .select({ name: schema.materials.name, unit: schema.materials.unit })
          .from(schema.materials)
          .where(eq(schema.materials.id, line.materialId))
        row = found
      }
      if (!row) throw createError({ statusCode: 400, statusMessage: 'Perlengkapan tidak ditemukan' })
      names.push(`${row.name} ${line.quantity} ${row.unit}`)
    } else {
      const packaging = await loadPackagingRow(tx, schema, line.packagingId)
      if (!packaging) throw createError({ statusCode: 400, statusMessage: 'Produk tidak ditemukan' })
      const multiplier = packagingMeterMultiplier(packaging)
      const purchaseUnit = packaging.purchaseUnit || (multiplier > 1 ? 'roll' : packaging.unit)
      if (line.stockQuantity > 0) {
        const delta = packagingStockDelta(packaging, line.stockQuantity)
        const meterPrice =
          multiplier > 1 ? Math.max(Math.round(Number(line.landedUnit || 0) / multiplier), 0) : line.landedUnit
        const [updated] = await tx
          .update(schema.packaging)
          .set({
            stockQuantity: sql`${schema.packaging.stockQuantity} + ${delta}`,
            pricePerUnit: meterPrice
          })
          .where(eq(schema.packaging.id, line.packagingId))
          .returning({ name: schema.packaging.name, unit: schema.packaging.unit })
        if (!updated) throw createError({ statusCode: 400, statusMessage: 'Produk tidak ditemukan' })
      }
      names.push(`${packaging.name} ${line.quantity} ${purchaseUnit}`)
    }
  }
  return names
}

function purchaseExpenseDescription(supplier, names, parsed) {
  return `Pembelian ke ${supplier}: ${names.join(', ')}${
    parsed.extras
      ? ` · ongkir ${parsed.shippingFee.toLocaleString('id-ID')} · fee ${parsed.platformFee.toLocaleString('id-ID')}`
      : ''
  }`
}

async function syncPurchaseExpense(tx, schema, { purchase, parsed, names, expenseId }) {
  const hasMaterial = parsed.lines.some((l) => l.itemType === 'material')
  const hasPackaging = parsed.lines.some((l) => l.itemType === 'packaging')
  const fallback = hasMaterial ? 'material' : hasPackaging ? 'packaging' : 'other'
  const cat = await assertExpenseCategory(tx, schema, parsed.category || fallback)
  const payload = {
    date: parsed.date,
    category: cat.key,
    description: purchaseExpenseDescription(purchase.supplier, names, parsed),
    amount: parsed.totalAmount,
    relatedProductId: parsed.projectId
  }

  let expense = null
  if (expenseId) {
    const [updated] = await tx
      .update(schema.expenses)
      .set(payload)
      .where(eq(schema.expenses.id, expenseId))
      .returning()
    expense = updated || null
  }
  if (!expense) {
    ;[expense] = await tx.insert(schema.expenses).values(payload).returning()
  }
  await setExpenseProducts(tx, schema, expense.id, parsed.projectId ? [parsed.projectId] : [])
  return expense
}

async function linkPurchaseExpense(tx, schema, purchase, expense) {
  if (purchase.expenseId === expense.id) return purchase
  const [updated] = await tx
    .update(schema.supplierPurchases)
    .set({ expenseId: expense.id })
    .where(eq(schema.supplierPurchases.id, purchase.id))
    .returning()
  return updated
}

export async function createSupplierPurchase(tx, schema, body) {
  const parsed = parsePurchaseBody(body)
  await assertProject(tx, schema, parsed.projectId)

  const [purchase] = await tx
    .insert(schema.supplierPurchases)
    .values({
      date: parsed.date,
      supplier: parsed.supplier,
      notes: parsed.notes,
      totalAmount: parsed.totalAmount,
      shippingFee: parsed.shippingFee,
      platformFee: parsed.platformFee,
      projectId: parsed.projectId
    })
    .returning()

  const names = await insertPricedLines(tx, schema, purchase.id, parsed.priced)
  const expense = await syncPurchaseExpense(tx, schema, {
    purchase,
    parsed,
    names,
    expenseId: null
  })
  const updated = await linkPurchaseExpense(tx, schema, purchase, expense)
  return { purchase: updated, expense }
}

export async function updateSupplierPurchase(tx, schema, id, body) {
  const parsed = parsePurchaseBody(body)
  await assertProject(tx, schema, parsed.projectId)

  const [existing] = await tx.select().from(schema.supplierPurchases).where(eq(schema.supplierPurchases.id, id))
  if (!existing) throw createError({ statusCode: 404, statusMessage: 'Pembelian tidak ditemukan' })

  const oldLines = await tx
    .select()
    .from(schema.supplierPurchaseLines)
    .where(eq(schema.supplierPurchaseLines.purchaseId, id))
  for (const line of oldLines) {
    await revertPurchaseLineStock(tx, schema, line)
  }
  await tx.delete(schema.supplierPurchaseLines).where(eq(schema.supplierPurchaseLines.purchaseId, id))

  const [purchase] = await tx
    .update(schema.supplierPurchases)
    .set({
      date: parsed.date,
      supplier: parsed.supplier,
      notes: parsed.notes,
      totalAmount: parsed.totalAmount,
      shippingFee: parsed.shippingFee,
      platformFee: parsed.platformFee,
      projectId: parsed.projectId
    })
    .where(eq(schema.supplierPurchases.id, id))
    .returning()

  const names = await insertPricedLines(tx, schema, purchase.id, parsed.priced)
  const expense = await syncPurchaseExpense(tx, schema, {
    purchase,
    parsed,
    names,
    expenseId: existing.expenseId
  })
  const updated = await linkPurchaseExpense(tx, schema, purchase, expense)
  return { purchase: updated, expense }
}
