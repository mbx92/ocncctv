export const QUOTE_OFFICIAL_DEFAULTS = {
  title: 'SURAT PENAWARAN HARGA',
  greeting: 'Dengan hormat,',
  intro: 'Bersama ini kami sampaikan penawaran harga untuk pekerjaan {{pekerjaan}} sebagai berikut:',
  terms: 'Dokumen ini adalah surat penawaran harga, bukan invoice.',
  closing:
    'Demikian penawaran ini kami sampaikan. Atas perhatian dan kerjasamanya, kami ucapkan terima kasih.',
  signOff: 'Hormat kami,',
  signer: '',
  signHint: '(tanda tangan / stempel)'
}

function cleanText(value, fallback) {
  const text = String(value ?? '').replace(/\r\n/g, '\n').trim()
  return text || fallback
}

export function applyQuotePlaceholders(text, vars) {
  return String(text || '').replace(/\{\{\s*(pekerjaan|pelanggan|perusahaan|tipe|nomor)\s*\}\}/gi, (_, key) => {
    const map = {
      pekerjaan: vars.title,
      pelanggan: vars.customerName,
      perusahaan: vars.businessName,
      tipe: vars.jobTypeLabel,
      nomor: vars.quoteNumber
    }
    return map[String(key).toLowerCase()] || ''
  })
}

export function resolveOfficialQuoteCopy(settings, vars) {
  const title = applyQuotePlaceholders(
    cleanText(settings?.quoteOfficialTitle, QUOTE_OFFICIAL_DEFAULTS.title),
    vars
  )
  const greeting = applyQuotePlaceholders(
    cleanText(settings?.quoteOfficialGreeting, QUOTE_OFFICIAL_DEFAULTS.greeting),
    vars
  )
  const intro = applyQuotePlaceholders(
    cleanText(settings?.quoteOfficialIntro, QUOTE_OFFICIAL_DEFAULTS.intro),
    vars
  )
  const termsText = applyQuotePlaceholders(
    cleanText(settings?.quoteOfficialTerms, QUOTE_OFFICIAL_DEFAULTS.terms),
    vars
  )
  const closing = applyQuotePlaceholders(
    cleanText(settings?.quoteOfficialClosing, QUOTE_OFFICIAL_DEFAULTS.closing),
    vars
  )
  const signOff = applyQuotePlaceholders(
    cleanText(settings?.quoteOfficialSignOff, QUOTE_OFFICIAL_DEFAULTS.signOff),
    vars
  )
  const signer = applyQuotePlaceholders(
    cleanText(settings?.quoteOfficialSigner, vars.businessName || 'OCN'),
    vars
  )
  const signHint = cleanText(settings?.quoteOfficialSignHint, QUOTE_OFFICIAL_DEFAULTS.signHint)
  const terms = termsText
    .split('\n')
    .map((row) => row.replace(/^[-•]\s*/, '').trim())
    .filter(Boolean)
  return { title, greeting, intro, terms, closing, signOff, signer, signHint }
}
