import { desc, eq } from 'drizzle-orm'
import { useDb, schema } from '../../db/index.js'
import { requireAdmin } from '../../utils/rbac.js'
import { presentUser } from '../../utils/userAccount.js'

export default defineEventHandler(async (event) => {
  requireAdmin(event)
  const db = useDb()
  const rows = await db
    .select({
      id: schema.users.id,
      username: schema.users.username,
      role: schema.users.role,
      technicianId: schema.users.technicianId,
      technicianName: schema.technicians.name,
      createdAt: schema.users.createdAt
    })
    .from(schema.users)
    .leftJoin(schema.technicians, eq(schema.users.technicianId, schema.technicians.id))
    .orderBy(desc(schema.users.createdAt))
  return rows.map(presentUser)
})
