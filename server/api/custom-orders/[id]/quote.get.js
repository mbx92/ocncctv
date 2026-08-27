import { loadRabQuotePayload } from '../../../utils/rabQuote.js'
import { useDb } from '../../../db/index.js'

export default defineEventHandler(async (event) => {
  const id = Number(getRouterParam(event, 'id'))
  const quote = await loadRabQuotePayload(useDb(), id)
  if (!quote) throw createError({ statusCode: 404, statusMessage: 'RAB tidak ditemukan' })
  return quote
})
