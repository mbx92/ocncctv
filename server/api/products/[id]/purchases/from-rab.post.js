import { useDb, schema } from '../../../../db/index.js'
import { logAudit } from '../../../../utils/audit.js'
import { createPurchaseFromRab } from '../../../../utils/rabPurchase.js'

export default defineEventHandler(async (event) => {
  const productId = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(productId) || productId <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'ID proyek tidak valid' })
  }
  const body = (await readBody(event).catch(() => null)) || {}
  const db = useDb()
  const result = await createPurchaseFromRab(db, schema, productId, body)

  await logAudit(event, {
    action: 'create',
    entity: 'supplier_purchase',
    entityId: result.purchase.id,
    summary: `Pembelian dari RAB proyek id ${productId} ke "${result.purchase.supplier}" Rp ${result.purchase.totalAmount.toLocaleString('id-ID')}`
  })

  return {
    purchase: result.purchase,
    expense: result.expense
  }
})
