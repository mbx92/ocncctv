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

export async function buildInvoicePdf(invoice) {
  const doc = await PDFDocument.create()
  const pageWidth = 595.28
  const pageHeight = 841.89
  let page = doc.addPage([pageWidth, pageHeight]) // A4 portrait (210 × 297 mm)
  const font = await doc.embedFont(StandardFonts.Helvetica)
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold)
  const ink = rgb(0.12, 0.14, 0.16)
  const muted = rgb(0.4, 0.42, 0.45)
  const line = rgb(0.85, 0.86, 0.88)

  let y = 780
  const left = 48
  const right = 547

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
  page.drawText(String(invoice.business.name || 'OCN'), {
    x: textLeft,
    y: y + 18,
    size: 14,
    font: fontBold,
    color: ink
  })
  let infoY = y
  if (invoice.business.address) {
    for (const row of String(invoice.business.address).split('\n')) {
      const wrapped = wrapText(font, row, 9, 280)
      for (const w of wrapped) {
        page.drawText(w, { x: textLeft, y: infoY, size: 9, font, color: muted })
        infoY -= 12
      }
    }
  }
  if (invoice.business.phone) {
    page.drawText(String(invoice.business.phone), {
      x: textLeft,
      y: infoY,
      size: 9,
      font,
      color: muted
    })
  }

  const invNo = String(invoice.invoiceNumber || 'Invoice')
  const invW = fontBold.widthOfTextAtSize(invNo, 13)
  page.drawText('INVOICE', {
    x: right - font.widthOfTextAtSize('INVOICE', 9),
    y: y + 20,
    size: 9,
    font,
    color: muted
  })
  page.drawText(invNo, { x: right - invW, y: y + 4, size: 13, font: fontBold, color: ink })
  const dateLabel = formatInvoiceDate(invoice.date)
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

  page.drawText('KEPADA', { x: left, y, size: 8, font: fontBold, color: muted })
  page.drawText('PEMBAYARAN', {
    x: right - fontBold.widthOfTextAtSize('PEMBAYARAN', 8),
    y,
    size: 8,
    font: fontBold,
    color: muted
  })
  y -= 14
  page.drawText(String(invoice.customerName || '—'), { x: left, y, size: 11, font: fontBold, color: ink })
  const payParts = [invoice.paymentStatusLabel, invoice.paymentMethodLabel].filter(Boolean)
  const payLine = String(payParts.join(' · ') || '—')
  page.drawText(payLine, {
    x: right - font.widthOfTextAtSize(payLine, 11),
    y,
    size: 11,
    font,
    color: ink
  })
  if (invoice.paidAt) {
    y -= 13
    const paidLabel = formatInvoiceDate(invoice.paidAt)
    page.drawText(paidLabel, {
      x: right - font.widthOfTextAtSize(paidLabel, 9),
      y,
      size: 9,
      font,
      color: muted
    })
  }

  y -= 28
  const bottom = 52
  let continued = false

  function newPage() {
    page = doc.addPage([pageWidth, pageHeight])
    y = 780
    continued = true
  }

  function drawTableHeader() {
    if (continued) {
      const cont = `${invoice.invoiceNumber || 'Invoice'} (lanjutan)`
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

  function ensure(space) {
    if (y < bottom + space) newPage()
  }

  drawTableHeader()

  const items = invoice.items?.length ? invoice.items : invoice.item ? [invoice.item] : []
  for (const item of items) {
    const nameBits = [item.name]
    if (item.code) nameBits.push(item.code)
    if (item.lineType === 'service') nameBits.push('Jasa')
    const nameLines = wrapText(font, nameBits.filter(Boolean).join(' · '), 10, 250)
    const rowH = Math.max(nameLines.length, 1) * 12 + 8
    if (y - rowH < bottom + 80) {
      newPage()
      drawTableHeader()
    }
    for (const [i, row] of nameLines.entries()) {
      page.drawText(row, { x: left, y: y - i * 12, size: 10, font, color: ink })
    }
    const qty = item.unit ? formatQuoteQty(item) : String(item.quantity ?? '')
    const price = formatInvoiceIDR(item.unitPrice)
    const amount = formatInvoiceIDR(item.amount)
    page.drawText(qty, { x: 318, y, size: 10, font, color: ink })
    page.drawText(price, { x: 390, y, size: 10, font, color: ink })
    page.drawText(amount, { x: right - font.widthOfTextAtSize(amount, 10), y, size: 10, font, color: ink })
    y -= rowH
  }

  ensure(80)
  page.drawLine({ start: { x: 330, y }, end: { x: right, y }, thickness: 0.5, color: line })
  y -= 16
  const sub = formatInvoiceIDR(invoice.subtotal)
  page.drawText('Subtotal', { x: 330, y, size: 10, font, color: muted })
  page.drawText(sub, { x: right - font.widthOfTextAtSize(sub, 10), y, size: 10, font, color: ink })
  if (invoice.discount) {
    y -= 16
    const discLabel = String(invoice.discountLabel || 'Diskon')
    const discAmount = `- ${formatInvoiceIDR(invoice.discount)}`
    page.drawText(discLabel, { x: 330, y, size: 10, font, color: muted })
    page.drawText(discAmount, { x: right - font.widthOfTextAtSize(discAmount, 10), y, size: 10, font, color: ink })
  }
  y -= 18
  const total = formatInvoiceIDR(invoice.total)
  page.drawText('Total', { x: 330, y, size: 11, font: fontBold, color: ink })
  page.drawText(total, { x: right - fontBold.widthOfTextAtSize(total, 11), y, size: 11, font: fontBold, color: ink })

  y -= 36
  if (invoice.notes) {
    const notes = wrapText(font, `Catatan: ${invoice.notes}`, 9, right - left)
    for (const row of notes) {
      page.drawText(row, { x: left, y, size: 9, font, color: muted })
      y -= 12
    }
    y -= 8
  }
  const footer = String(invoice.business.footer || '')
  if (footer) {
    for (const row of wrapParagraphs(font, footer, 10, right - left)) {
      if (row) page.drawText(row, { x: left, y, size: 10, font, color: ink })
      y -= 13
    }
  }

  return doc.save()
}

export function invoicePdfFilename(invoice) {
  const raw = String(invoice?.invoiceNumber || 'invoice').replace(/[^\w.-]+/g, '_')
  return `${raw}.pdf`
}
