export const USER_ROLES = ['admin', 'staff', 'technician']

export function isTechnician(event) {
  return event.context.auth?.role === 'technician'
}

export function requireAdmin(event) {
  if (event.context.auth?.role !== 'admin') {
    throw createError({ statusCode: 403, statusMessage: 'Aksi ini khusus admin' })
  }
}

export function requireTechnician(event) {
  if (event.context.auth?.role !== 'technician') {
    throw createError({ statusCode: 403, statusMessage: 'Aksi ini khusus teknisi' })
  }
}

export function parseUserRole(body = {}) {
  const role = String(body.role || '').trim()
  if (!USER_ROLES.includes(role)) {
    throw createError({ statusCode: 400, statusMessage: 'Role tidak valid' })
  }
  const technicianId = role === 'technician' ? Number(body.technicianId) || 0 : null
  if (role === 'technician' && !technicianId) {
    throw createError({ statusCode: 400, statusMessage: 'Pilih teknisi untuk akun ini' })
  }
  return { role, technicianId: technicianId || null }
}
