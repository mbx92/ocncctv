import { loadTechnicianWork } from '../../../utils/technicianWork.js'

export default defineEventHandler(async (event) => {
  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id) || id <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'ID teknisi tidak valid' })
  }
  return loadTechnicianWork(id)
})
