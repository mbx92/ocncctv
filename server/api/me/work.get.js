import { loadTechnicianWork, requireLinkedTechnicianId } from '../../utils/technicianWork.js'

export default defineEventHandler(async (event) => {
  const technicianId = await requireLinkedTechnicianId(event)
  return loadTechnicianWork(technicianId)
})
