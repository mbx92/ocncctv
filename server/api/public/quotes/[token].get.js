import { loadPublicQuote } from '../../../utils/rabQuote.js'

export default defineEventHandler(async (event) => {
  const token = getRouterParam(event, 'token')
  const { quote, expiresAt } = await loadPublicQuote(token)
  return { ...quote, expiresAt }
})
