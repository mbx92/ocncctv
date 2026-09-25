import { eq } from 'drizzle-orm'
import { loadProjectFinanceMap, downPaymentTotal, projectGrossRevenue } from './projectRevenue.js'
import { resolveDiscount } from './salePayment.js'

export function saleRecordedAmount(sale) {
  const qty = Math.max(Math.round(Number(sale?.quantity) || 0), 0)
  const price = Math.max(Math.round(Number(sale?.salePricePerUnit) || 0), 0)
  return qty * price
}

export function saleSyncState(sale, currentRevenue) {
  if (!sale) {
    return {
      saleId: null,
      invoiceNumber: null,
      recorded: 0,
      current: 0,
      delta: 0,
      locked: false,
      outOfSync: false
    }
  }
  const recorded = saleRecordedAmount(sale)
  const current = Math.max(Math.round(Number(currentRevenue) || 0), 0)
  const locked = !!sale.invoiceLocked
  return {
    saleId: sale.id,
    invoiceNumber: sale.invoiceNumber || null,
    recorded,
    current,
    delta: current - recorded,
    locked,
    outOfSync: !locked && recorded !== current
  }
}

export async function loadSaleForProduct(db, schema, productId) {
  const [sale] = await db
    .select({
      id: schema.sales.id,
      invoiceNumber: schema.sales.invoiceNumber,
      quantity: schema.sales.quantity,
      salePricePerUnit: schema.sales.salePricePerUnit,
      discountKind: schema.sales.discountKind,
      discountPercent: schema.sales.discountPercent,
      discountAmount: schema.sales.discountAmount,
      downPaymentAmount: schema.sales.downPaymentAmount,
      paymentStatus: schema.sales.paymentStatus,
      invoiceLocked: schema.sales.invoiceLocked
    })
    .from(schema.sales)
    .where(eq(schema.sales.productId, productId))
    .limit(1)
  return sale || null
}

export async function loadSaleScopeSync(db, schema, productId) {
  const sale = await loadSaleForProduct(db, schema, productId)
  if (!sale) return saleSyncState(null, 0)
  const financeMap = await loadProjectFinanceMap(db, schema, [productId])
  return saleSyncState(sale, projectGrossRevenue(financeMap.get(productId)?.summary))
}

export async function resyncProjectSale(tx, schema, productId) {
  const sale = await loadSaleForProduct(tx, schema, productId)
  if (!sale) throw createError({ statusCode: 404, statusMessage: 'Penjualan proyek ini belum dicatat' })
  const financeMap = await loadProjectFinanceMap(tx, schema, [productId])
  const finance = financeMap.get(productId)
  const current = projectGrossRevenue(finance?.summary)
  const previous = saleSyncState(sale, current)
  if (!previous.outOfSync) return { ...previous, updated: false }
  const discount = resolveDiscount(
    {
      discountKind: sale.discountKind,
      discountPercent: sale.discountPercent,
      discountAmount: sale.discountAmount
    },
    current
  )
  const [updated] = await tx
    .update(schema.sales)
    .set({
      salePricePerUnit: current,
      downPaymentAmount: downPaymentTotal(finance?.downPayments || []),
      invoiceLocked: false,
      ...discount
    })
    .where(eq(schema.sales.id, sale.id))
    .returning()
  return {
    ...saleSyncState(updated, current),
    previous: previous.recorded,
    updated: true
  }
}

export async function keepProjectSaleInvoice(tx, schema, productId) {
  const sale = await loadSaleForProduct(tx, schema, productId)
  if (!sale) throw createError({ statusCode: 404, statusMessage: 'Penjualan proyek ini belum dicatat' })
  const financeMap = await loadProjectFinanceMap(tx, schema, [productId])
  const current = projectGrossRevenue(financeMap.get(productId)?.summary)
  const recorded = saleRecordedAmount(sale)
  const qty = Math.max(Math.round(Number(sale.quantity) || 0), 1)
  const gap = Math.max(current - recorded, 0)
  if (sale.invoiceLocked && gap === 0) return { ...saleSyncState(sale, current), updated: false }
  const existing = resolveDiscount(
    {
      discountKind: sale.discountKind,
      discountPercent: sale.discountPercent,
      discountAmount: sale.discountAmount
    },
    recorded
  )
  const nextGross = Math.max(recorded, current)
  const discount = resolveDiscount(
    { discountKind: 'amount', discountAmount: existing.discountAmount + gap },
    nextGross
  )
  const [updated] = await tx
    .update(schema.sales)
    .set({
      salePricePerUnit: Math.round(nextGross / qty),
      invoiceLocked: true,
      ...discount
    })
    .where(eq(schema.sales.id, sale.id))
    .returning()
  return { ...saleSyncState(updated, current), updated: true }
}
