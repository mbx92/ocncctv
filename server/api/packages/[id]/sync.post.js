import { eq } from 'drizzle-orm'
import { useDb, schema } from '../../../db/index.js'
import { logAudit } from '../../../utils/audit.js'
import { getSettings } from '../../../utils/settings.js'
import {
  loadPackageLines,
  replacePackageLines,
  syncPackageLinePrices,
  withPackageTotals
} from '../../../utils/packages.js'
import { parseRabLines } from '../../../utils/customOrders.js'

export default defineEventHandler(async (event) => {
  const id = Number(getRouterParam(event, 'id'))
  const db = useDb()
  const settings = await getSettings()
  const result = await db.transaction(async (tx) => {
    const [existing] = await tx.select().from(schema.packages).where(eq(schema.packages.id, id))
    if (!existing) throw createError({ statusCode: 404, statusMessage: 'Paket tidak ditemukan' })
    const lineMap = await loadPackageLines(tx, [id])
    const synced = await syncPackageLinePrices(tx, parseRabLines(lineMap.get(id) || []), settings)
    await replacePackageLines(tx, id, synced)
    const fresh = await loadPackageLines(tx, [id])
    return withPackageTotals(existing, fresh.get(id) || [])
  })
  await logAudit(event, {
    action: 'update',
    entity: 'package',
    entityId: id,
    summary: `Sync harga paket "${result.name}"`
  })
  return result
})
