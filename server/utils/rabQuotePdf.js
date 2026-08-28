import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import { formatInvoiceDate, formatInvoiceIDR } from './invoice.js'
import { formatQuoteQty } from './rabQuote.js'

function logoPngBytes() {
  const candidates = [
    join(process.cwd(), 'public', 'pwa-192x192.png'),
    join(process.cwd(), '.output', 'public', 'pwa-192x192.png')
  ]
  const path = candidates.find((p) => existsSync(p))
  if (!path) return null
  return readFileSync(path)
}

function wrapText(font, text, size, maxWidth) {
  const words = String(text || '').split(/\s+/).filter(Boolean)
  if (!words.length) return []
  const lines = []
  let current = words[0]
  for (let i = 1; i < words.length; i++) {
    const next = `${current} ${words[i]}`
    if (font.widthOfTextAtSize(next, size) <= maxWidth) current = next
    else {
      lines.push(current)
      current = words[i]
    }
  }
  lines.push(current)
  return lines
}

function wrapParagraphs(font, text, size, maxWidth) {
  const paragraphs = String(text || '').replace(/\r\n/g, '\n').split('\n')
  const lines = []
  for (const p of paragraphs) {
    if (!p.trim()) {
      lines.push('')
      continue
    }
    const wrapped = wrapText(font, p, size, maxWidth)
    lines.push(...(wrapped.length ? wrapped : ['']))
  }
  return lines
}

export async function buildRabQuotePdf(quote) {
  const doc = await PDFDocument.create()
  const font = await doc.embedFont(StandardFonts.Helvetica)
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold)
  const ink = rgb(0.12, 0.14, 0.16)
  const muted = rgb(0.4, 0.42, 0.45)
  const line = rgb(0.85, 0.86, 0.88)
  const left = 48
  const right = 547
  const pageWidth = 595.28
  const pageHeight = 841.89
  const bottom = 52

  let page = doc.addPage([pageWidth, pageHeight])
  let y = 780
  let continued = false

  function newPage() {
    page = doc.addPage([pageWidth, pageHeight])
    y = 780
    continued = true
  }

  function ensure(space) {
    if (y < bottom + space) newPage()
  }

  const png = logoPngBytes()
  if (png) {
    try {
      const img = await doc.embedPng(png)
      page.drawImage(img, { x: left, y: y - 8, width: 42, height: 42 })
    } catch {
      /* logo opsional */
    }
  }

  const textLeft = png ? left + 54 : left
  page.drawText(String(quote.business.name || 'OCN'), {
    x: textLeft,
    y: y + 18,
    size: 14,
    font: fontBold,
    color: ink
  })
  let infoY = y
  if (quote.business.address) {
    for (const row of String(quote.business.address).split('\n')) {
      const wrapped = wrapText(font, row, 9, 280)
      for (const w of wrapped) {
        page.drawText(w, { x: textLeft, y: infoY, size: 9, font, color: muted })
        infoY -= 12
      }
    }
  }
  if (quote.business.phone) {
    page.drawText(String(quote.business.phone), {
      x: textLeft,
      y: infoY,
      size: 9,
      font,
      color: muted
    })
  }

  const label = String(quote.docLabel || 'Penawaran').toUpperCase()
  const quoteNo = String(quote.quoteNumber || label)
  const quoteW = fontBold.widthOfTextAtSize(quoteNo, 13)
  page.drawText(label, {
    x: right - font.widthOfTextAtSize(label, 9),
    y: y + 20,
    size: 9,
    font,
    color: muted
  })
  page.drawText(quoteNo, { x: right - quoteW, y: y + 4, size: 13, font: fontBold, color: ink })
  const dateLabel = formatInvoiceDate(quote.date)
  page.drawText(dateLabel, {
    x: right - font.widthOfTextAtSize(dateLabel, 9),
    y: y - 12,
    size: 9,
    font,
    color: muted
  })

  y = Math.min(infoY, y - 12) - 28
  page.drawLine({ start: { x: left, y }, end: { x: right, y }, thickness: 1, color: line })
  y -= 24

  if (quote.customerName) {
    page.drawText('KEPADA', { x: left, y, size: 8, font: fontBold, color: muted })
    page.drawText('PEKERJAAN', {
      x: right - fontBold.widthOfTextAtSize('PEKERJAAN', 8),
      y,
      size: 8,
      font: fontBold,
      color: muted
    })
    y -= 14
    page.drawText(String(quote.customerName), { x: left, y, size: 11, font: fontBold, color: ink })
    const titleLines = wrapText(font, String(quote.title || '—'), 11, 250)
    for (const [i, row] of titleLines.entries()) {
      page.drawText(row, {
        x: right - font.widthOfTextAtSize(row, 11),
        y: y - i * 13,
        size: 11,
        font,
        color: ink
      })
    }
    y -= Math.max(titleLines.length, 1) * 13 + 16
  } else {
    page.drawText('PAKET', { x: left, y, size: 8, font: fontBold, color: muted })
    y -= 14
    const titleLines = wrapText(fontBold, String(quote.title || '—'), 11, right - left)
    for (const row of titleLines) {
      page.drawText(row, { x: left, y, size: 11, font: fontBold, color: ink })
      y -= 13
    }
    y -= 8
  }

  function drawTableHeader() {
    if (continued) {
      const cont = `${quote.quoteNumber || 'Penawaran'} (lanjutan)`
      page.drawText(cont, { x: left, y, size: 9, font, color: muted })
      y -= 18
    }
    page.drawLine({ start: { x: left, y }, end: { x: right, y }, thickness: 1, color: line })
    y -= 18
    page.drawText('ITEM', { x: left, y, size: 8, font: fontBold, color: muted })
    page.drawText('QTY', { x: 318, y, size: 8, font: fontBold, color: muted })
    page.drawText('HARGA', { x: 390, y, size: 8, font: fontBold, color: muted })
    page.drawText('JUMLAH', {
      x: right - font.widthOfTextAtSize('JUMLAH', 8),
      y,
      size: 8,
      font: fontBold,
      color: muted
    })
    y -= 10
    page.drawLine({ start: { x: left, y }, end: { x: right, y }, thickness: 0.5, color: line })
    y -= 16
  }

  drawTableHeader()

  const items = quote.items || []
  if (!items.length) {
    page.drawText('Belum ada item.', { x: left, y, size: 10, font, color: muted })
    y -= 20
  }

  for (const item of items) {
    const nameBits = [item.name]
    if (item.lineType === 'service') nameBits.push('Jasa')
    const nameLines = wrapText(font, nameBits.join(' · '), 10, 250)
    const rowH = Math.max(nameLines.length, 1) * 12 + 8
    if (y - rowH < bottom + 80) {
      newPage()
      drawTableHeader()
    }
    for (const [i, row] of nameLines.entries()) {
      page.drawText(row, { x: left, y: y - i * 12, size: 10, font, color: ink })
    }
    const qty = formatQuoteQty(item)
    const price = formatInvoiceIDR(item.unitPrice)
    const amount = formatInvoiceIDR(item.amount)
    page.drawText(qty, { x: 318, y, size: 10, font, color: ink })
    page.drawText(price, { x: 390, y, size: 10, font, color: ink })
    page.drawText(amount, { x: right - font.widthOfTextAtSize(amount, 10), y, size: 10, font, color: ink })
    y -= rowH
  }

  ensure(48)
  page.drawLine({ start: { x: 330, y }, end: { x: right, y }, thickness: 0.5, color: line })
  y -= 18
  const total = formatInvoiceIDR(quote.total)
  page.drawText('Total', { x: 330, y, size: 11, font: fontBold, color: ink })
  page.drawText(total, { x: right - fontBold.widthOfTextAtSize(total, 11), y, size: 11, font: fontBold, color: ink })

  y -= 28
  const disclaimer = quote.docLabel
    ? 'Dokumen ini adalah daftar harga paket, bukan invoice.'
    : 'Dokumen ini adalah penawaran harga, bukan invoice.'
  ensure(16)
  page.drawText(disclaimer, { x: left, y, size: 9, font, color: muted })
  y -= 20

  if (quote.notes) {
    const notes = wrapText(font, `Catatan: ${quote.notes}`, 9, right - left)
    for (const row of notes) {
      ensure(14)
      page.drawText(row, { x: left, y, size: 9, font, color: muted })
      y -= 12
    }
    y -= 8
  }

  const footer = String(quote.business.footer || '')
  if (footer) {
    for (const row of wrapParagraphs(font, footer, 10, right - left)) {
      ensure(16)
      if (row) page.drawText(row, { x: left, y, size: 10, font, color: ink })
      y -= 13
    }
  }

  return doc.save()
}

export function rabQuotePdfFilename(quote) {
  const raw = String(quote?.quoteNumber || 'penawaran').replace(/[^\w.-]+/g, '_')
  return `${raw}.pdf`
}
