import { eq } from 'drizzle-orm'
import { useDb, schema } from '../../db/index.js'
import { logAudit } from '../../utils/audit.js'
import { allocateInvoiceNumber } from '../../utils/invoice.js'
import { parseSalePayment } from '../../utils/salePayment.js'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  if (!body.date || !body.productId) {
    throw createError({ statusCode: 400, statusMessage: 'Tanggal dan proyek wajib diisi' })
  }
  const productId = Number(body.productId)
  const channel = body.channel || 'direct'
  const payment = parseSalePayment(body, channel, body.date, body)
  const db = useDb()
  const rows = await db.transaction(async (tx) => {
    const [product] = await tx.select().from(schema.products).where(eq(schema.products.id, productId))
    if (!product) throw createError({ statusCode: 400, statusMessage: 'Proyek tidak ditemukan' })

    const [sold] = await tx
      .select({ id: schema.sales.id })
      .from(schema.sales)
      .where(eq(schema.sales.productId, productId))
      .limit(1)
    if (sold) {
      throw createError({ statusCode: 400, statusMessage: 'Proyek ini sudah punya catatan penjualan' })
    }

    const [rab] = await tx
      .select()
      .from(schema.customOrders)
      .where(eq(schema.customOrders.projectId, productId))
      .limit(1)
    const customOrderId = rab?.id || null
    if (customOrderId) {
      const [soldRab] = await tx
        .select({ id: schema.sales.id })
        .from(schema.sales)
        .where(eq(schema.sales.customOrderId, customOrderId))
        .limit(1)
      if (soldRab) {
        throw createError({ statusCode: 400, statusMessage: 'RAB proyek ini sudah punya catatan penjualan' })
      }
    }

    const customerName =
      String(body.customerName || '').trim() || String(rab?.customerName || '').trim() || null
    const invoiceNumber = await allocateInvoiceNumber(tx, schema, body.date)
    const created = await tx
      .insert(schema.sales)
      .values({
        date: body.date,
        productId,
        customOrderId,
        quantity: 1,
        salePricePerUnit: Math.round(Number(body.salePricePerUnit) || 0),
        channel,
        marketplaceFeePercent: 0,
        notes: body.notes || null,
        customerName,
        invoiceNumber,
        ...payment
      })
      .returning()
    return created
  })
  await logAudit(event, {
    action: 'create',
    entity: 'sale',
    entityId: rows[0].id,
    summary: `Catat penjualan proyek id ${rows[0].productId}`
  })
  return rows[0]
})
