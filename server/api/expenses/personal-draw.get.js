import { loadPersonalDraw } from '../../utils/personalDraw.js'
import { useDb } from '../../db/index.js'

export default defineEventHandler(async () => {
  return loadPersonalDraw(useDb())
})
