import { and, eq } from 'drizzle-orm'
import { useDb, schema } from '../db/index.js'
import { requireTechnician } from './rbac.js'
import { sanitizeText } from './sanitizeText.js'

function money(value) {
  return Math.max(Math.round(Number(value) || 0), 0)
}

function mapProject(row, paidByProduct) {
  const wageAmount = money(row.wageAmount)
  const paidAmount = money(paidByProduct.get(row.id) || 0)
  return {
    id: row.id,
    name: sanitizeText(row.name) || row.name,
    status: row.status,
    customerName: row.customerName ? sanitizeText(row.customerName) : row.customerName,
    jobType: row.jobType,
    description: row.description ? sanitizeText(row.description) : row.description,
    plannedStartDate: row.plannedStartDate,
    startedAt: row.startedAt,
    completedAt: row.completedAt,
    wageAmount,
    paidAmount,
    unpaidAmount: Math.max(wageAmount - paidAmount, 0)
  }
}

async function paidByProductMap(db, technicianId) {
  const rows = await db
    .select({
      relatedProductId: schema.expenses.relatedProductId,
      amount: schema.expenses.amount
    })
    .from(schema.expenses)
    .where(and(eq(schema.expenses.technicianId, technicianId), eq(schema.expenses.category, 'technician')))
  const paid = new Map()
  let unassignedPaid = 0
  for (const row of rows) {
    const amount = money(row.amount)
    if (!row.relatedProductId) {
      unassignedPaid += amount
      continue
    }
    paid.set(row.relatedProductId, (paid.get(row.relatedProductId) || 0) + amount)
  }
  return { paid, unassignedPaid }
}

export async function requireLinkedTechnicianId(event) {
  requireTechnician(event)
  const db = useDb()
  const [user] = await db
    .select({ technicianId: schema.users.technicianId })
    .from(schema.users)
    .where(eq(schema.users.id, event.context.auth.id))
  if (!user?.technicianId) {
    throw createError({ statusCode: 403, statusMessage: 'Akun teknisi belum terhubung. Hubungi admin.' })
  }
  return user.technicianId
}

export async function loadTechnicianWork(technicianId) {
  const db = useDb()
  const [technician] = await db.select().from(schema.technicians).where(eq(schema.technicians.id, technicianId))
  if (!technician) {
    throw createError({ statusCode: 403, statusMessage: 'Akun teknisi belum terhubung. Hubungi admin.' })
  }

  const wageRows = await db
    .select({
      id: schema.products.id,
      name: schema.products.name,
      status: schema.products.status,
      customerName: schema.products.customerName,
      jobType: schema.products.jobType,
      description: schema.products.description,
      plannedStartDate: schema.products.plannedStartDate,
      startedAt: schema.products.startedAt,
      completedAt: schema.products.completedAt,
      wageAmount: schema.projectTechnicianWages.amount
    })
    .from(schema.projectTechnicianWages)
    .innerJoin(schema.products, eq(schema.projectTechnicianWages.productId, schema.products.id))
    .where(eq(schema.projectTechnicianWages.technicianId, technicianId))

  const merged = new Map()
  for (const row of wageRows) {
    const existing = merged.get(row.id)
    if (existing) existing.wageAmount += money(row.wageAmount)
    else merged.set(row.id, { ...row, wageAmount: money(row.wageAmount) })
  }

  const { paid, unassignedPaid } = await paidByProductMap(db, technicianId)
  const projects = [...merged.values()]
    .map((row) => mapProject(row, paid))
    .sort((a, b) => String(b.plannedStartDate || b.startedAt || '').localeCompare(String(a.plannedStartDate || a.startedAt || '')) || a.name.localeCompare(b.name, 'id'))

  const wageTotal = projects.reduce((sum, p) => sum + p.wageAmount, 0)
  const paidOnProjects = projects.reduce((sum, p) => sum + p.paidAmount, 0)
  const paidTotal = paidOnProjects + unassignedPaid
  const unpaidTotal = Math.max(wageTotal - paidOnProjects, 0)

  return {
    technician: { id: technician.id, name: sanitizeText(technician.name) || technician.name },
    summary: {
      projectCount: projects.length,
      wageTotal,
      paidTotal,
      unpaidTotal
    },
    projects
  }
}

export async function loadTechnicianProject(technicianId, productId) {
  const work = await loadTechnicianWork(technicianId)
  const project = work.projects.find((p) => p.id === productId)
  if (!project) throw createError({ statusCode: 404, statusMessage: 'Proyek tidak ditemukan' })
  return { technician: work.technician, project }
}
