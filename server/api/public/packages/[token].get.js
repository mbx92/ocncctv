import { loadPublicPackage } from '../../../utils/packages.js'

export default defineEventHandler(async (event) => {
  const token = getRouterParam(event, 'token')
  const { quote } = await loadPublicPackage(token)
  return quote
})
