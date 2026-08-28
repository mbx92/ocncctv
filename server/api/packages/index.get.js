import { desc } from 'drizzle-orm'
import { useDb, schema } from '../../db/index.js'
import { loadPackageLines, withPackageTotals } from '../../utils/packages.js'

export default defineEventHandler(async () => {
  const db = useDb()
  const rows = await db.select().from(schema.packages).orderBy(desc(schema.packages.id))
  const lineMap = await loadPackageLines(
    db,
    rows.map((r) => r.id)
  )
  return rows.map((row) => {
    const lines = lineMap.get(row.id) || []
    const withTotals = withPackageTotals(row, lines)
    return {
      ...row,
      lineCount: lines.length,
      totalSale: withTotals.totalSale,
      totalCost: withTotals.totalCost,
      margin: withTotals.margin
    }
  })
})
