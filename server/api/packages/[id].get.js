import { eq } from 'drizzle-orm'
import { useDb, schema } from '../../db/index.js'
import { loadPackageLines, withPackageTotals } from '../../utils/packages.js'

export default defineEventHandler(async (event) => {
  const id = Number(getRouterParam(event, 'id'))
  const db = useDb()
  const [row] = await db.select().from(schema.packages).where(eq(schema.packages.id, id))
  if (!row) throw createError({ statusCode: 404, statusMessage: 'Paket tidak ditemukan' })
  const lineMap = await loadPackageLines(db, [id])
  return withPackageTotals(row, lineMap.get(id) || [])
})
