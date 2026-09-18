export function presentUser(row) {
  return {
    id: row.id,
    username: row.username,
    role: row.role,
    technicianId: row.technicianId || null,
    technicianName: row.technicianName || null,
    createdAt: row.createdAt
  }
}

export function userUniqueError(err, role) {
  if (err?.code !== '23505') return null
  const detail = String(err.detail || err.constraint || '')
  if (detail.includes('technician_id') || detail.includes('users_technician_id')) {
    return createError({ statusCode: 409, statusMessage: 'Teknisi ini sudah punya akun' })
  }
  if (role === 'technician' && /technician/i.test(detail)) {
    return createError({ statusCode: 409, statusMessage: 'Teknisi ini sudah punya akun' })
  }
  return createError({ statusCode: 409, statusMessage: 'Username sudah dipakai' })
}
