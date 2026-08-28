import { eq } from 'drizzle-orm'
import { sanitizeText } from './sanitizeText.js'

export function mapTechnician(row) {
  if (!row) return row
  return {
    ...row,
    name: sanitizeText(row.name) || row.name,
    notes: row.notes ? sanitizeText(row.notes) : row.notes
  }
}

export async function findTechnician(db, schema, technicianId) {
  const id = Number(technicianId) || 0
  if (!id) return null
  const [row] = await db.select().from(schema.technicians).where(eq(schema.technicians.id, id))
  return row || null
}
