import { and, eq, gt } from 'drizzle-orm'
import { useDb, schema } from '../../../db/index.js'
import { getSettings } from '../../../utils/settings.js'
import { clampShareTtlDays, newShareToken } from '../../../utils/invoice.js'

export default defineEventHandler(async (event) => {
  const id = Number(getRouterParam(event, 'id'))
  const body = await readBody(event).catch(() => ({}))
  const rotate = !!body?.rotate
  const db = useDb()
  const settings = await getSettings()
  const ttlDays = clampShareTtlDays(settings.invoiceShareTtlDays)

  const result = await db.transaction(async (tx) => {
    const [row] = await tx.select({ id: schema.customOrders.id }).from(schema.customOrders).where(eq(schema.customOrders.id, id))
    if (!row) throw createError({ statusCode: 404, statusMessage: 'RAB tidak ditemukan' })

    if (!rotate) {
      const [existing] = await tx
        .select()
        .from(schema.rabShareLinks)
        .where(and(eq(schema.rabShareLinks.customOrderId, id), gt(schema.rabShareLinks.expiresAt, new Date())))
        .limit(1)
      if (existing) return { token: existing.token, expiresAt: existing.expiresAt, reused: true }
    } else {
      await tx.delete(schema.rabShareLinks).where(eq(schema.rabShareLinks.customOrderId, id))
    }

    const token = newShareToken()
    const expiresAt = new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000)
    const [created] = await tx
      .insert(schema.rabShareLinks)
      .values({ customOrderId: id, token, expiresAt })
      .returning()
    return { token: created.token, expiresAt: created.expiresAt, reused: false }
  })

  return {
    path: `/q/${result.token}`,
    expiresAt: result.expiresAt,
    ttlDays,
    reused: result.reused
  }
})
