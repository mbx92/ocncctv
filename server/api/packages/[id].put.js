import { eq } from 'drizzle-orm'
import { useDb, schema } from '../../db/index.js'
import { logAudit } from '../../utils/audit.js'
import { loadPackageLines, parsePackageBody, replacePackageLines, withPackageTotals } from '../../utils/packages.js'

export default defineEventHandler(async (event) => {
  const id = Number(getRouterParam(event, 'id'))
  const body = await readBody(event)
  const { header, lines } = parsePackageBody(body, { allowEmptyLines: true })
  const db = useDb()
  const { updated, savedLines } = await db.transaction(async (tx) => {
    const [existing] = await tx.select().from(schema.packages).where(eq(schema.packages.id, id))
    if (!existing) throw createError({ statusCode: 404, statusMessage: 'Paket tidak ditemukan' })
    const [row] = await tx.update(schema.packages).set(header).where(eq(schema.packages.id, id)).returning()
    if (lines) await replacePackageLines(tx, id, lines)
    const lineMap = await loadPackageLines(tx, [id])
    return { updated: row, savedLines: lineMap.get(id) || [] }
  })
  await logAudit(event, {
    action: 'update',
    entity: 'package',
    entityId: id,
    summary: `Ubah paket "${updated.name}"`
  })
  return withPackageTotals(updated, savedLines)
})
