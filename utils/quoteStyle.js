export const QUOTE_STYLES = ['ringkas', 'resmi']

export const quoteStyleLabel = {
  ringkas: 'Ringkas',
  resmi: 'Resmi'
}

export function parseQuoteStyle(value) {
  return String(value || '').trim() === 'resmi' ? 'resmi' : 'ringkas'
}
