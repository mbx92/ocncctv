import { useDb, schema } from '../../db/index.js'
import { logAudit } from '../../utils/audit.js'
import { createSupplierPurchase } from '../../utils/supplierPurchase.js'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const db = useDb()
  const result = await db.transaction(async (tx) => createSupplierPurchase(tx, schema, body))

  await logAudit(event, {
    action: 'create',
    entity: 'supplier_purchase',
    entityId: result.purchase.id,
    summary: `Pembelian ke "${result.purchase.supplier}" Rp ${result.purchase.totalAmount.toLocaleString('id-ID')} (stok + pengeluaran otomatis)`
  })
  return result.purchase
})
