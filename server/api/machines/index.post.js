import { useDb, schema } from '../../db/index.js'
import { requireAdmin } from '../../utils/rbac.js'
import { logAudit } from '../../utils/audit.js'
import { normalizeAcquisition, syncMachinePurchaseExpense } from '../../utils/machineExpense.js'
import { parseMachineQuantity, machineUnitPrice } from '../../utils/machines.js'

export default defineEventHandler(async (event) => {
  requireAdmin(event)
  const body = await readBody(event)
  if (!body.name) throw createError({ statusCode: 400, statusMessage: 'Nama wajib diisi' })
  const db = useDb()
  const machine = await db.transaction(async (tx) => {
    const [row] = await tx
      .insert(schema.machines)
      .values({
        name: body.name,
        powerWatt: Math.round(Number(body.powerWatt) || 0),
        purchasePrice: machineUnitPrice(body.purchasePrice),
        quantity: parseMachineQuantity(body.quantity),
        purchaseDate: body.purchaseDate || null,
        depreciationMonths: Math.round(Number(body.depreciationMonths) || 36),
        notes: body.notes || null,
        acquisition: normalizeAcquisition(body.acquisition)
      })
      .returning()
    return syncMachinePurchaseExpense(tx, schema, row)
  })
  await logAudit(event, { action: 'create', entity: 'machine', entityId: machine.id, summary: `Tambah peralatan "${machine.name}"` })
  return machine
})
