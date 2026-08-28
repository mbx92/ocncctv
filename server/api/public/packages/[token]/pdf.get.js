import { loadPublicPackage } from '../../../../utils/packages.js'
import { buildRabQuotePdf, rabQuotePdfFilename } from '../../../../utils/rabQuotePdf.js'

export default defineEventHandler(async (event) => {
  const token = getRouterParam(event, 'token')
  const { quote } = await loadPublicPackage(token)
  const bytes = await buildRabQuotePdf(quote)
  setResponseHeaders(event, {
    'Content-Type': 'application/pdf',
    'Content-Disposition': `attachment; filename="${rabQuotePdfFilename(quote)}"`
  })
  return send(event, Buffer.from(bytes))
})
