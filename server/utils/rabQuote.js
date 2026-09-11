import { and, eq, gt } from 'drizzle-orm'
import { useDb, schema } from '../db/index.js'
import { getSettings } from './settings.js'
import { loadRabLines, presentRabLines } from './customOrders.js'
import { catalogDisplayName } from './catalogName.js'
import { jobTypeLabelOf } from './jobType.js'
import { resolveOfficialQuoteCopy } from './quoteOfficial.js'

export function quoteNumberFor(id) {
  const n = Math.max(Math.round(Number(id) || 0), 0)
  return `RAB-${String(n).padStart(4, '0')}`
}

export function formatQuoteQty(item) {
  const qty = Number(item?.quantity) || 0
  const n = Number.isInteger(qty) ? String(qty) : String(qty)
  const unit = String(item?.unit || '').trim()
  return unit ? `${n} ${unit}` : n
}

export function toRabQuotePayload(order, lines, settings) {
  let items = presentRabLines(lines).map((line) => {
    const qty = Math.max(Math.round(Number(line.quantity) || 0), 0)
    const unitPrice = Math.max(Math.round(Number(line.salePrice) || 0), 0)
    const lineType =
      line.lineType === 'service' ? 'service' : line.lineType === 'product' ? 'product' : 'catalog'
    return {
      name: String(line.name || '').trim() || 'Item',
      code: line.code || '',
      lineType,
      quantity: qty,
      unit: String(line.unit || '').trim(),
      unitPrice,
      amount: qty * unitPrice
    }
  })
  if (!items.length && Number(order.pricePerUnit)) {
    const amount = Math.max(Math.round(Number(order.pricePerUnit) || 0), 0)
    items = [
      {
        name: String(order.title || '').trim() || 'Pekerjaan',
        code: '',
        lineType: 'catalog',
        quantity: 1,
        unit: '',
        unitPrice: amount,
        amount
      }
    ]
  }
  const total = items.reduce((sum, item) => sum + item.amount, 0)
  const quoteNumber = quoteNumberFor(order.id)
  const businessName = settings.invoiceBusinessName || 'OCN'
  const jobTypeLabel = jobTypeLabelOf(order.jobType)
  return {
    quoteNumber,
    date: order.date,
    customerName: order.customerName,
    title: order.title,
    notes: order.notes || null,
    items,
    total,
    jobType: order.jobType || null,
    jobTypeLabel,
    official: resolveOfficialQuoteCopy(settings, {
      title: order.title || 'pekerjaan ini',
      customerName: order.customerName || 'Pelanggan',
      businessName,
      jobTypeLabel: jobTypeLabel || '',
      quoteNumber
    }),
    business: {
      name: businessName,
      address: settings.invoiceAddress || null,
      phone: settings.invoicePhone || null,
      footer: settings.rabFooter || null
    }
  }
}

export async function loadRabQuotePayload(db, id) {
  const [order] = await db.select().from(schema.customOrders).where(eq(schema.customOrders.id, id))
  if (!order) return null
  const lineMap = await loadRabLines(db, [id])
  const settings = await getSettings()
  return toRabQuotePayload(order, lineMap.get(id) || [], settings)
}

export async function loadPublicQuote(token) {
  const raw = String(token || '').trim()
  if (!raw) throw createError({ statusCode: 404, statusMessage: 'Tautan tidak valid' })
  const db = useDb()
  const [link] = await db
    .select()
    .from(schema.rabShareLinks)
    .where(and(eq(schema.rabShareLinks.token, raw), gt(schema.rabShareLinks.expiresAt, new Date())))
    .limit(1)
  if (!link) throw createError({ statusCode: 404, statusMessage: 'Tautan tidak valid atau sudah kedaluwarsa' })
  const quote = await loadRabQuotePayload(db, link.customOrderId)
  if (!quote) throw createError({ statusCode: 404, statusMessage: 'Penawaran tidak ditemukan' })
  return { quote, expiresAt: link.expiresAt }
}
