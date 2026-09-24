import { loadPackagingLots } from '../../../utils/packagingLots.js'
import { useDb, schema } from '../../../db/index.js'

export default defineEventHandler(async (event) => {
  const projectId = Number(getRouterParam(event, 'id'))
  return loadPackagingLots(useDb(), schema, { projectId })
})
