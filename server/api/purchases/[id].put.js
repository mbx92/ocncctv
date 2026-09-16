import { useDb, schema } from '../../db/index.js'
import { logAudit } from '../../utils/audit.js'
import { updateSupplierPurchase } from '../../utils/supplierPurchase.js'

export default defineEventHandler(async (event) => {
  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id) || id <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'Pembelian tidak valid' })
  }
  const body = await readBody(event)
  const db = useDb()
  const result = await db.transaction(async (tx) => updateSupplierPurchase(tx, schema, id, body))

  await logAudit(event, {
    action: 'update',
    entity: 'supplier_purchase',
    entityId: result.purchase.id,
    summary: `Ubah pembelian ke "${result.purchase.supplier}" Rp ${result.purchase.totalAmount.toLocaleString('id-ID')}`
  })
  return result.purchase
})
