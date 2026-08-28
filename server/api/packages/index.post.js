import { useDb, schema } from '../../db/index.js'
import { logAudit } from '../../utils/audit.js'
import { parsePackageBody, replacePackageLines, loadPackageLines, withPackageTotals } from '../../utils/packages.js'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { header, lines } = parsePackageBody(body, { allowEmptyLines: true })
  const db = useDb()
  const result = await db.transaction(async (tx) => {
    const [created] = await tx.insert(schema.packages).values(header).returning()
    await replacePackageLines(tx, created.id, lines || [])
    const lineMap = await loadPackageLines(tx, [created.id])
    return withPackageTotals(created, lineMap.get(created.id) || [])
  })
  await logAudit(event, {
    action: 'create',
    entity: 'package',
    entityId: result.id,
    summary: `Tambah paket "${result.name}"`
  })
  return result
})
