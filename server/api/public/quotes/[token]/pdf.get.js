import { loadPublicQuote } from '../../../../utils/rabQuote.js'
import { buildRabQuotePdf, rabQuotePdfFilename } from '../../../../utils/rabQuotePdf.js'

export default defineEventHandler(async (event) => {
  const token = getRouterParam(event, 'token')
  const { quote } = await loadPublicQuote(token)
  const bytes = await buildRabQuotePdf(quote)
  setResponseHeaders(event, {
    'Content-Type': 'application/pdf',
    'Content-Disposition': `attachment; filename="${rabQuotePdfFilename(quote)}"`
  })
  return send(event, Buffer.from(bytes))
})
