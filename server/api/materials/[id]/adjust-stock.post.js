import { useDb, schema } from '../../../db/index.js'
import { logAudit } from '../../../utils/audit.js'
import { applyMaterialStockDelta } from '../../../utils/materialStock.js'

// Pakai / koreksi stok: body { delta } (positif = masuk tanpa kas, negatif = dipakai).
export default defineEventHandler(async (event) => {
  const id = Number(getRouterParam(event, 'id'))
  const body = await readBody(event)
  const delta = Number(body.delta) || 0
  if (!delta) throw createError({ statusCode: 400, statusMessage: 'Qty perubahan wajib diisi' })
  const db = useDb()
  const row = await db.transaction(async (tx) => applyMaterialStockDelta(tx, schema, { id, delta }))
  if (!row) throw createError({ statusCode: 404, statusMessage: 'Perlengkapan tidak ditemukan' })
  await logAudit(event, {
    action: 'update',
    entity: 'material',
    entityId: id,
    summary: `Stok "${row.name}": ${delta >= 0 ? '+' : ''}${delta} ${row.unit}`
  })
  return row
})
