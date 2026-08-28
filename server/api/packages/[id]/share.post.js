import { createPackageShareLink } from '../../../utils/packages.js'
import { useDb } from '../../../db/index.js'

export default defineEventHandler(async (event) => {
  const id = Number(getRouterParam(event, 'id'))
  const body = await readBody(event).catch(() => ({}))
  const result = await createPackageShareLink(useDb(), id, { rotate: !!body?.rotate })
  return {
    path: `/p/${result.token}`,
    expiresAt: result.expiresAt,
    ttlDays: result.ttlDays,
    reused: result.reused
  }
})
