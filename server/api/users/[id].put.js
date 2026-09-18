import bcrypt from 'bcryptjs'
import { eq, and, ne, count } from 'drizzle-orm'
import { useDb, schema } from '../../db/index.js'
import { requireAdmin, parseUserRole } from '../../utils/rbac.js'
import { logAudit } from '../../utils/audit.js'
import { findTechnician } from '../../utils/technicians.js'
import { presentUser, userUniqueError } from '../../utils/userAccount.js'

export default defineEventHandler(async (event) => {
  requireAdmin(event)
  const id = Number(getRouterParam(event, 'id'))
  const body = await readBody(event)
  const { role, technicianId } = parseUserRole(body)

  const db = useDb()
  if (role !== 'admin') {
    const [{ value }] = await db
      .select({ value: count() })
      .from(schema.users)
      .where(and(eq(schema.users.role, 'admin'), ne(schema.users.id, id)))
    if (Number(value) === 0) {
      throw createError({ statusCode: 400, statusMessage: 'Minimal harus ada 1 admin' })
    }
  }
  if (technicianId) {
    const tech = await findTechnician(db, schema, technicianId)
    if (!tech) throw createError({ statusCode: 400, statusMessage: 'Teknisi tidak ditemukan' })
  }

  const values = { username: body.username, role, technicianId }
  if (body.password) {
    if (body.password.length < 6) throw createError({ statusCode: 400, statusMessage: 'Password minimal 6 karakter' })
    values.passwordHash = await bcrypt.hash(body.password, 10)
  }

  try {
    const rows = await db
      .update(schema.users)
      .set(values)
      .where(eq(schema.users.id, id))
      .returning({
        id: schema.users.id,
        username: schema.users.username,
        role: schema.users.role,
        technicianId: schema.users.technicianId,
        createdAt: schema.users.createdAt
      })
    if (!rows.length) throw createError({ statusCode: 404, statusMessage: 'User tidak ditemukan' })
    await logAudit(event, {
      action: 'update',
      entity: 'user',
      entityId: id,
      summary: `Ubah user "${rows[0].username}" (role ${rows[0].role}${body.password ? ', reset password' : ''})`
    })
    return presentUser(rows[0])
  } catch (e) {
    const mapped = userUniqueError(e, role)
    if (mapped) throw mapped
    throw e
  }
})
