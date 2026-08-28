import { loadPackageQuotePayload } from '../../../utils/packages.js'
import { useDb } from '../../../db/index.js'

export default defineEventHandler(async (event) => {
  const id = Number(getRouterParam(event, 'id'))
  const quote = await loadPackageQuotePayload(useDb(), id)
  if (!quote) throw createError({ statusCode: 404, statusMessage: 'Paket tidak ditemukan' })
  return quote
})
