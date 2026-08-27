import { loadRabQuotePayload } from '../../../../utils/rabQuote.js'
import { buildRabQuotePdf, rabQuotePdfFilename } from '../../../../utils/rabQuotePdf.js'
import { useDb } from '../../../../db/index.js'

export default defineEventHandler(async (event) => {
  const id = Number(getRouterParam(event, 'id'))
  const quote = await loadRabQuotePayload(useDb(), id)
  if (!quote) throw createError({ statusCode: 404, statusMessage: 'RAB tidak ditemukan' })
  const bytes = await buildRabQuotePdf(quote)
  setResponseHeaders(event, {
    'Content-Type': 'application/pdf',
    'Content-Disposition': `attachment; filename="${rabQuotePdfFilename(quote)}"`
  })
  return send(event, Buffer.from(bytes))
})
