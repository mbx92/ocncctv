import bcrypt from 'bcryptjs'
import { useDb, schema } from '../../db/index.js'
import { requireAdmin, parseUserRole } from '../../utils/rbac.js'
import { logAudit } from '../../utils/audit.js'
import { findTechnician } from '../../utils/technicians.js'
import { presentUser, userUniqueError } from '../../utils/userAccount.js'

export default defineEventHandler(async (event) => {
  requireAdmin(event)
  const body = await readBody(event)
  if (!body.username) throw createError({ statusCode: 400, statusMessage: 'Username wajib diisi' })
  if (!body.password || body.password.length < 6) {
    throw createError({ statusCode: 400, statusMessage: 'Password minimal 6 karakter' })
  }
  const { role, technicianId } = parseUserRole(body)
  const db = useDb()
  if (technicianId) {
    const tech = await findTechnician(db, schema, technicianId)
    if (!tech) throw createError({ statusCode: 400, statusMessage: 'Teknisi tidak ditemukan' })
  }

  const passwordHash = await bcrypt.hash(body.password, 10)
  try {
    const rows = await db
      .insert(schema.users)
      .values({ username: body.username, passwordHash, role, technicianId })
      .returning({
        id: schema.users.id,
        username: schema.users.username,
        role: schema.users.role,
        technicianId: schema.users.technicianId,
        createdAt: schema.users.createdAt
      })
    await logAudit(event, {
      action: 'create',
      entity: 'user',
      entityId: rows[0].id,
      summary: `Tambah user "${rows[0].username}" (role ${rows[0].role})`
    })
    return presentUser(rows[0])
  } catch (e) {
    const mapped = userUniqueError(e, role)
    if (mapped) throw mapped
    throw e
  }
})
