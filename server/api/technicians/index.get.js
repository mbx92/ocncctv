import { asc } from 'drizzle-orm'
import { useDb, schema } from '../../db/index.js'
import { mapTechnician } from '../../utils/technicians.js'

export default defineEventHandler(async () => {
  const db = useDb()
  const rows = await db.select().from(schema.technicians).orderBy(asc(schema.technicians.name))
  return rows.map(mapTechnician)
})
