import { randomBytes } from 'node:crypto'
import { eq, sql } from 'drizzle-orm'
import { loadRabLines, presentRabLines } from './customOrders.js'
import { applyRabAdjustments, loadProjectExtraLines, loadProjectRabAdjustments } from './projectLines.js'

const CHANNEL_LABEL = {
  tokopedia: 'Tokopedia',
  shopee: 'Shopee',
  tiktok_shop: 'TikTok Shop',
  instagram: 'Instagram',
  whatsapp: 'WhatsApp',
  direct: 'Langsung',
  other: 'Lainnya'
}

const PAYMENT_METHOD_LABEL = {
  cash: 'Tunai',
  transfer: 'Transfer',
  marketplace: 'Lainnya',
  other: 'Lainnya'
}

const PAYMENT_STATUS_LABEL = {
  unpaid: 'Belum dibayar',
  paid: 'Lunas'
}

const MONTHS_ID = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']

function yyyymmFromDate(dateStr) {
  const raw = String(dateStr || '').slice(0, 10).replace(/-/g, '')
  if (raw.length >= 6) return raw.slice(0, 6)
  const d = new Date()
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}`
}

export function formatInvoiceIDR(value) {
  const n = Math.round(Number(value) || 0)
  const sign = n < 0 ? '-' : ''
  const grouped = String(Math.abs(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  return 'Rp ' + sign + grouped
}

export function formatInvoiceDate(value) {
  if (!value) return '-'
  const raw = String(value)
  const m = raw.match(/^(\d{4})-(\d{2})-(\d{2})/)
  let y
  let mo
  let d
  if (m) {
    y = Number(m[1])
    mo = Number(m[2])
    d = Number(m[3])
  } else {
    const dt = new Date(value)
    if (Number.isNaN(dt.getTime())) return '-'
    y = dt.getFullYear()
    mo = dt.getMonth() + 1
    d = dt.getDate()
  }
  return `${String(d).padStart(2, '0')} ${MONTHS_ID[mo - 1] || mo} ${y}`
}

export async function allocateInvoiceNumber(tx, schema, dateStr) {
  const prefix = `INV-${yyyymmFromDate(dateStr)}-`
  const rows = await tx
    .select({ invoiceNumber: schema.sales.invoiceNumber })
    .from(schema.sales)
    .where(sql`${schema.sales.invoiceNumber} like ${prefix + '%'}`)
  let max = 0
  for (const r of rows) {
    const n = Number(String(r.invoiceNumber || '').slice(prefix.length))
    if (Number.isFinite(n) && n > max) max = n
  }
  return `${prefix}${String(max + 1).padStart(4, '0')}`
}

export async function ensureSaleInvoiceNumber(tx, schema, sale) {
  if (sale?.invoiceNumber) return sale
  const invoiceNumber = await allocateInvoiceNumber(tx, schema, sale.date)
  const [updated] = await tx
    .update(schema.sales)
    .set({ invoiceNumber })
    .where(eq(schema.sales.id, sale.id))
    .returning()
  return updated || { ...sale, invoiceNumber }
}

export async function loadSaleInvoiceRow(tx, schema, id) {
  const [row] = await tx
    .select({
      id: schema.sales.id,
      date: schema.sales.date,
      productId: schema.sales.productId,
      customOrderId: schema.sales.customOrderId,
      productName: schema.products.name,
      customTitle: schema.customOrders.title,
      customCustomerName: schema.customOrders.customerName,
      quantity: schema.sales.quantity,
      salePricePerUnit: schema.sales.salePricePerUnit,
      channel: schema.sales.channel,
      notes: schema.sales.notes,
      invoiceNumber: schema.sales.invoiceNumber,
      customerName: schema.sales.customerName,
      paymentStatus: schema.sales.paymentStatus,
      paymentMethod: schema.sales.paymentMethod,
      paidAt: schema.sales.paidAt,
      discountAmount: schema.sales.discountAmount,
      discountKind: schema.sales.discountKind,
      discountPercent: schema.sales.discountPercent
    })
    .from(schema.sales)
    .leftJoin(schema.products, eq(schema.sales.productId, schema.products.id))
    .leftJoin(schema.customOrders, eq(schema.sales.customOrderId, schema.customOrders.id))
    .where(eq(schema.sales.id, id))
  return row || null
}

function itemsFromRabLines(lines) {
  return (lines || [])
    .map((line) => {
      const quantity = Math.max(Math.round(Number(line.quantity) || 0), 0)
      const unitPrice = Math.max(Math.round(Number(line.salePrice) || 0), 0)
      return {
        name: String(line.name || '').trim() || 'Item',
        code: line.code || '',
        lineType:
          line.lineType === 'service' ? 'service' : line.lineType === 'product' ? 'product' : 'catalog',
        quantity,
        unit: String(line.unit || '').trim(),
        unitPrice,
        amount: quantity * unitPrice
      }
    })
    .filter((item) => item.quantity > 0)
}

function buildInvoiceItems(row, lines) {
  const qty = row.quantity
  const unitPrice = row.salePricePerUnit
  const amount = qty * unitPrice
  const fallback = [
    {
      name: row.productName || row.customTitle || 'Proyek',
      code: '',
      lineType: 'catalog',
      quantity: qty,
      unit: '',
      unitPrice,
      amount
    }
  ]
  const lineItems = itemsFromRabLines(lines)
  if (!lineItems.length) return { items: fallback, subtotal: amount }

  const lineSum = lineItems.reduce((sum, item) => sum + item.amount, 0)
  const items = [...lineItems]
  const diff = amount - lineSum
  if (diff !== 0) {
    items.push({
      name: 'Penyesuaian',
      code: '',
      lineType: 'catalog',
      quantity: 1,
      unit: '',
      unitPrice: diff,
      amount: diff
    })
  }
  return { items, subtotal: amount }
}

export function toInvoicePayload(row, settings, lines = []) {
  const { items, subtotal } = buildInvoiceItems(row, lines)
  const discount = Math.min(Math.max(Math.round(Number(row.discountAmount) || 0), 0), subtotal)
  const discountKind = row.discountKind === 'percent' ? 'percent' : 'amount'
  const discountPercent = Math.min(Math.max(Number(row.discountPercent) || 0, 0), 100)
  const paid = row.paymentStatus === 'paid'
  const methodLabel = PAYMENT_METHOD_LABEL[row.paymentMethod] || row.paymentMethod || null
  const customerName = row.customerName || row.customCustomerName || '—'
  return {
    id: row.id,
    invoiceNumber: row.invoiceNumber,
    date: row.date,
    customerName,
    channel: row.channel,
    channelLabel: CHANNEL_LABEL[row.channel] || row.channel,
    paymentStatus: paid ? 'paid' : 'unpaid',
    paymentStatusLabel: paid ? PAYMENT_STATUS_LABEL.paid : PAYMENT_STATUS_LABEL.unpaid,
    paymentMethod: paid ? row.paymentMethod || null : null,
    paymentMethodLabel: paid ? methodLabel : null,
    paidAt: paid ? row.paidAt || null : null,
    notes: row.notes,
    isCustom: !!row.customOrderId,
    item: items[0] || null,
    items,
    subtotal,
    discount,
    discountKind,
    discountPercent,
    discountLabel:
      discount > 0
        ? discountKind === 'percent'
          ? `Diskon ${discountPercent}%`
          : 'Diskon'
        : null,
    total: subtotal - discount,
    business: {
      name: settings.invoiceBusinessName || 'OCN',
      address: settings.invoiceAddress || null,
      phone: settings.invoicePhone || null,
      footer: settings.invoiceFooter || 'Terima kasih telah berbelanja.'
    }
  }
}

export async function buildInvoicePayload(db, schema, row, settings) {
  let orderId = row.customOrderId || null
  if (!orderId && row.productId) {
    const [rab] = await db
      .select({ id: schema.customOrders.id })
      .from(schema.customOrders)
      .where(eq(schema.customOrders.projectId, row.productId))
      .limit(1)
    orderId = rab?.id || null
  }
  let lines = []
  if (orderId) {
    const map = await loadRabLines(db, [orderId])
    let rabLines = presentRabLines(map.get(orderId) || [])
    if (row.productId) {
      const productId = row.productId
      const [adjMap, extraMap] = await Promise.all([
        loadProjectRabAdjustments(db, schema, [productId]),
        loadProjectExtraLines(db, schema, [productId])
      ])
      rabLines = applyRabAdjustments(rabLines, adjMap.get(productId) || []).filter(
        (line) => !line.omitted && (Number(line.quantity) || 0) > 0
      )
      lines = [...rabLines, ...(extraMap.get(productId) || [])]
    } else {
      lines = rabLines
    }
  }
  return toInvoicePayload(row, settings, lines)
}

export function newShareToken() {
  return randomBytes(24).toString('base64url')
}

export function clampShareTtlDays(value) {
  const n = Math.round(Number(value) || 7)
  return Math.min(Math.max(n, 1), 365)
}
