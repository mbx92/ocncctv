import { eq } from 'drizzle-orm'
import { useDb, schema } from '../../db/index.js'
import { requireAdmin } from '../../utils/rbac.js'
import { logAudit } from '../../utils/audit.js'
import { normalizeAcquisition, syncMachinePurchaseExpense } from '../../utils/machineExpense.js'

export default defineEventHandler(async (event) => {
  requireAdmin(event)
  const id = Number(getRouterParam(event, 'id'))
  const body = await readBody(event)
  const db = useDb()
  const machine = await db.transaction(async (tx) => {
    const [existing] = await tx.select().from(schema.machines).where(eq(schema.machines.id, id))
    if (!existing) throw createError({ statusCode: 404, statusMessage: 'Peralatan tidak ditemukan' })
    const [row] = await tx
      .update(schema.machines)
      .set({
        name: body.name,
        powerWatt: Math.round(Number(body.powerWatt) || existing.powerWatt || 0),
        purchasePrice: Math.round(Number(body.purchasePrice) || 0),
        purchaseDate: body.purchaseDate || null,
        depreciationMonths: Math.round(Number(body.depreciationMonths) || 36),
        notes: body.notes || null,
        acquisition: normalizeAcquisition(body.acquisition ?? existing.acquisition)
      })
      .where(eq(schema.machines.id, id))
      .returning()
    return syncMachinePurchaseExpense(tx, schema, row)
  })
  await logAudit(event, { action: 'update', entity: 'machine', entityId: id, summary: `Ubah peralatan "${machine.name}"` })
  return machine
})
