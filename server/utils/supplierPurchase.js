import { eq, sql } from 'drizzle-orm'
import { assertExpenseCategory } from './expenseCategory.js'
import { setExpenseProducts } from './expenseProducts.js'
import { applyMaterialStockDelta } from './materialStock.js'
import { sanitizeText } from './sanitizeText.js'

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

export async function createSupplierPurchase(tx, schema, body) {
  const parsed = parsePurchaseBody(body)

  if (parsed.projectId) {
    const [project] = await tx
      .select({ id: schema.products.id, name: schema.products.name })
      .from(schema.products)
      .where(eq(schema.products.id, parsed.projectId))
    if (!project) throw createError({ statusCode: 400, statusMessage: 'Proyek tidak ditemukan' })
  }

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

  const names = []
  for (const line of parsed.priced) {
    const amount = lineAmount(line.quantity, line.unitPrice)
    await tx.insert(schema.supplierPurchaseLines).values({
      purchaseId: purchase.id,
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
      let row
      if (line.stockQuantity > 0) {
        const [updated] = await tx
          .update(schema.packaging)
          .set({
            stockQuantity: sql`${schema.packaging.stockQuantity} + ${line.stockQuantity}`,
            pricePerUnit: line.landedUnit
          })
          .where(eq(schema.packaging.id, line.packagingId))
          .returning({ name: schema.packaging.name, unit: schema.packaging.unit })
        row = updated
      } else {
        const [found] = await tx
          .select({ name: schema.packaging.name, unit: schema.packaging.unit })
          .from(schema.packaging)
          .where(eq(schema.packaging.id, line.packagingId))
        row = found
      }
      if (!row) throw createError({ statusCode: 400, statusMessage: 'Produk tidak ditemukan' })
      names.push(`${row.name} ${line.quantity} ${row.unit}`)
    }
  }

  const hasMaterial = parsed.lines.some((l) => l.itemType === 'material')
  const hasPackaging = parsed.lines.some((l) => l.itemType === 'packaging')
  const fallback = hasMaterial ? 'material' : hasPackaging ? 'packaging' : 'other'
  const cat = await assertExpenseCategory(tx, schema, parsed.category || fallback)
  const [expense] = await tx
    .insert(schema.expenses)
    .values({
      date: parsed.date,
      category: cat.key,
      description: `Pembelian ke ${purchase.supplier}: ${names.join(', ')}${
        parsed.extras
          ? ` · ongkir ${parsed.shippingFee.toLocaleString('id-ID')} · fee ${parsed.platformFee.toLocaleString('id-ID')}`
          : ''
      }`,
      amount: parsed.totalAmount,
      relatedProductId: parsed.projectId
    })
    .returning()
  await setExpenseProducts(tx, schema, expense.id, parsed.projectId ? [parsed.projectId] : [])

  const [updated] = await tx
    .update(schema.supplierPurchases)
    .set({ expenseId: expense.id })
    .where(eq(schema.supplierPurchases.id, purchase.id))
    .returning()

  return { purchase: updated, expense }
}
