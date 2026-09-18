import { loadTechnicianProject, requireLinkedTechnicianId } from '../../../utils/technicianWork.js'

export default defineEventHandler(async (event) => {
  const technicianId = await requireLinkedTechnicianId(event)
  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id) || id <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'ID proyek tidak valid' })
  }
  return loadTechnicianProject(technicianId, id)
})
