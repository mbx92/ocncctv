import { applyQuotePlaceholders } from './quoteOfficial.js'

export const INVOICE_OFFICIAL_DEFAULTS = {
  title: 'INVOICE',
  greeting: 'Dengan hormat,',
  intro: 'Bersama ini kami sampaikan tagihan untuk {{pekerjaan}} sebagai berikut:',
  terms: 'Harap dilunasi sesuai jumlah yang tercantum pada dokumen ini.',
  closing:
    'Demikian invoice ini kami sampaikan. Atas perhatian dan kerjasamanya, kami ucapkan terima kasih.',
  signOff: 'Hormat kami,',
  signer: '',
  signHint: '(tanda tangan / stempel)'
}

function cleanText(value, fallback) {
  const text = String(value ?? '').replace(/\r\n/g, '\n').trim()
  return text || fallback
}

export function resolveOfficialInvoiceCopy(settings, vars) {
  const title = applyQuotePlaceholders(
    cleanText(settings?.invoiceOfficialTitle, INVOICE_OFFICIAL_DEFAULTS.title),
    vars
  )
  const greeting = applyQuotePlaceholders(
    cleanText(settings?.invoiceOfficialGreeting, INVOICE_OFFICIAL_DEFAULTS.greeting),
    vars
  )
  const intro = applyQuotePlaceholders(
    cleanText(settings?.invoiceOfficialIntro, INVOICE_OFFICIAL_DEFAULTS.intro),
    vars
  )
  const termsText = applyQuotePlaceholders(
    cleanText(settings?.invoiceOfficialTerms, INVOICE_OFFICIAL_DEFAULTS.terms),
    vars
  )
  const closing = applyQuotePlaceholders(
    cleanText(settings?.invoiceOfficialClosing, INVOICE_OFFICIAL_DEFAULTS.closing),
    vars
  )
  const signOff = applyQuotePlaceholders(
    cleanText(settings?.quoteOfficialSignOff || settings?.invoiceOfficialSignOff, INVOICE_OFFICIAL_DEFAULTS.signOff),
    vars
  )
  const signer = applyQuotePlaceholders(
    cleanText(settings?.quoteOfficialSigner || settings?.invoiceOfficialSigner, vars.businessName || 'OCN'),
    vars
  )
  const signHint = cleanText(
    settings?.quoteOfficialSignHint || settings?.invoiceOfficialSignHint,
    INVOICE_OFFICIAL_DEFAULTS.signHint
  )
  const terms = termsText
    .split('\n')
    .map((row) => row.replace(/^[-•]\s*/, '').trim())
    .filter(Boolean)
  return { title, greeting, intro, terms, closing, signOff, signer, signHint }
}
