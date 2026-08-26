import { eq } from 'drizzle-orm'
import { useDb, schema } from '../../../db/index.js'
import { logAudit } from '../../../utils/audit.js'
import { parseSalePayment } from '../../../utils/salePayment.js'

export default defineEventHandler(async (event) => {
  const id = Number(getRouterParam(event, 'id'))
  const body = (await readBody(event).catch(() => null)) || {}
  const db = useDb()
  const [existing] = await db.select().from(schema.sales).where(eq(schema.sales.id, id))
  if (!existing) throw createError({ statusCode: 404, statusMessage: 'Penjualan tidak ditemukan' })

  const payment = parseSalePayment(
    { ...body, paymentStatus: body.paymentStatus || (body.paid === false ? 'unpaid' : 'paid') },
    existing.channel,
    body.paidAt || existing.date,
    existing
  )
  const [row] = await db
    .update(schema.sales)
    .set(payment)
    .where(eq(schema.sales.id, id))
    .returning()
  await logAudit(event, {
    action: 'update',
    entity: 'sale',
    entityId: id,
    summary:
      payment.paymentStatus === 'paid'
        ? `Tandai lunas penjualan id ${id}`
        : `Tandai belum bayar penjualan id ${id}`
  })
  return row
})
