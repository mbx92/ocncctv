import { loadPublicInvoice } from '../../../../utils/publicInvoice.js'
import { buildInvoicePdf, invoicePdfFilename } from '../../../../utils/invoicePdf.js'

export default defineEventHandler(async (event) => {
  const token = getRouterParam(event, 'token')
  const { invoice } = await loadPublicInvoice(token)
  const style = String(getQuery(event).tampilan || '') === 'resmi' ? 'resmi' : 'ringkas'
  const bytes = await buildInvoicePdf(invoice, { style })
  setResponseHeaders(event, {
    'Content-Type': 'application/pdf',
    'Content-Disposition': `attachment; filename="${invoicePdfFilename(invoice)}"`
  })
  return send(event, Buffer.from(bytes))
})
