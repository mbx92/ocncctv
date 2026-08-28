import { eq } from 'drizzle-orm'

export async function ensureTechnicianByName(tx, schema, name) {
  const trimmed = String(name || '').trim()
  if (!trimmed) return null
  const [existing] = await tx
    .select()
    .from(schema.technicians)
    .where(eq(schema.technicians.name, trimmed))
    .limit(1)
  if (existing) return existing
  const [created] = await tx.insert(schema.technicians).values({ name: trimmed }).returning()
  return created
}

export async function replaceProjectTechnicianWages(tx, schema, productId, rawWages) {
  await tx.delete(schema.projectTechnicianWages).where(eq(schema.projectTechnicianWages.productId, productId))
  const wages = []
  const seen = new Set()
  for (const row of rawWages || []) {
    const name = String(row?.name || '').trim()
    const amount = Math.max(Math.round(Number(row?.amount) || 0), 0)
    if (!name || amount <= 0) continue
    const tech = await ensureTechnicianByName(tx, schema, name)
    if (!tech || seen.has(tech.id)) continue
    seen.add(tech.id)
    wages.push({
      technicianId: tech.id,
      name: tech.name,
      amount,
      sortOrder: wages.length
    })
  }
  if (!wages.length) return []
  await tx.insert(schema.projectTechnicianWages).values(
    wages.map((row) => ({
      productId,
      technicianId: row.technicianId,
      name: row.name,
      amount: row.amount,
      sortOrder: row.sortOrder
    }))
  )
  return wages
}
