import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import { formatInvoiceDate, formatInvoiceIDR } from './invoice.js'
import { terbilangRupiah } from './terbilang.js'
import { INVOICE_OFFICIAL_DEFAULTS } from './invoiceOfficial.js'

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

function invoiceItems(invoice) {
  if (invoice.items?.length) return invoice.items
  return invoice.item ? [invoice.item] : []
}

function invoiceSections(invoice) {
  if (invoice.sections?.length) return invoice.sections.filter((section) => section.items?.length)
  const items = invoiceItems(invoice)
  return items.length ? [{ key: 'all', title: null, items }] : []
}

function invoiceItemQty(item) {
  const qty = Number(item?.quantity) || 0
  return Number.isInteger(qty) ? String(qty) : String(qty)
}

function invoiceItemUnit(item) {
  return String(item?.unit || '').trim() || (item?.lineType === 'service' ? 'ls' : 'pcs')
}

function invoiceTotalLabel(invoice) {
  return invoice.paymentStatus === 'unpaid' && invoice.downPayment ? 'Sisa tagihan' : 'Total'
}

export async function buildInvoicePdf(invoice, { style } = {}) {
  if (style === 'resmi') return buildOfficialInvoicePdf(invoice)
  return buildCompactInvoicePdf(invoice)
}

async function buildCompactInvoicePdf(invoice) {
  const doc = await PDFDocument.create()
  const pageWidth = 595.28
  const pageHeight = 841.89
  let page = doc.addPage([pageWidth, pageHeight])
  const font = await doc.embedFont(StandardFonts.Helvetica)
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold)
  const ink = rgb(0.12, 0.14, 0.16)
  const muted = rgb(0.4, 0.42, 0.45)
  const line = rgb(0.85, 0.86, 0.88)

  let y = 780
  const left = 48
  const right = 547
  const colNo = left
  const colName = left + 28
  const colQty = 318
  const colUnit = 365
  const colPrice = 410

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
  if (invoice.title) {
    y -= 13
    page.drawText(String(invoice.title), { x: left, y, size: 9, font, color: muted })
  }
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

  function textRight(str, xRight, size, usedFont, color) {
    page.drawText(str, {
      x: xRight - usedFont.widthOfTextAtSize(str, size),
      y,
      size,
      font: usedFont,
      color
    })
  }

  function drawTableHeader() {
    if (continued) {
      const cont = `${invoice.invoiceNumber || 'Invoice'} (lanjutan)`
      page.drawText(cont, { x: left, y, size: 9, font, color: muted })
      y -= 18
    }
    page.drawLine({ start: { x: left, y }, end: { x: right, y }, thickness: 1, color: line })
    y -= 18
    page.drawText('NO', { x: colNo, y, size: 8, font: fontBold, color: muted })
    page.drawText('URAIAN', { x: colName, y, size: 8, font: fontBold, color: muted })
    page.drawText('QTY', { x: colQty, y, size: 8, font: fontBold, color: muted })
    page.drawText('SAT.', { x: colUnit, y, size: 8, font: fontBold, color: muted })
    page.drawText('HARGA', { x: colPrice, y, size: 8, font: fontBold, color: muted })
    textRight('JUMLAH', right, 8, fontBold, muted)
    y -= 10
    page.drawLine({ start: { x: left, y }, end: { x: right, y }, thickness: 0.5, color: line })
    y -= 16
  }

  function ensure(space) {
    if (y < bottom + space) newPage()
  }

  drawTableHeader()

  let itemNo = 0
  for (const section of invoiceSections(invoice)) {
    if (section.title) {
      ensure(28)
      page.drawText(String(section.title).toUpperCase(), { x: left, y, size: 8, font: fontBold, color: muted })
      y -= 14
    }
    for (const item of section.items) {
      itemNo += 1
      const nameBits = [item.name]
      if (item.lineType === 'service') nameBits.push('Jasa')
      if (item.note) nameBits.push(item.note)
      const nameLines = wrapText(font, nameBits.filter(Boolean).join(' · '), 10, 250)
      const rowH = Math.max(nameLines.length, 1) * 12 + 8
      if (y - rowH < bottom + 80) {
        newPage()
        drawTableHeader()
      }
      page.drawText(String(itemNo), { x: colNo, y, size: 10, font, color: muted })
      for (const [i, row] of nameLines.entries()) {
        page.drawText(row, { x: colName, y: y - i * 12, size: 10, font, color: ink })
      }
      page.drawText(invoiceItemQty(item), { x: colQty, y, size: 10, font, color: ink })
      page.drawText(invoiceItemUnit(item), { x: colUnit, y, size: 10, font, color: muted })
      page.drawText(formatInvoiceIDR(item.unitPrice), { x: colPrice, y, size: 10, font, color: ink })
      textRight(formatInvoiceIDR(item.amount), right, 10, font, ink)
      y -= rowH
    }
  }

  ensure(110)
  page.drawLine({ start: { x: 330, y }, end: { x: right, y }, thickness: 0.5, color: line })
  y -= 16
  const sub = formatInvoiceIDR(invoice.subtotal)
  page.drawText('Subtotal', { x: 330, y, size: 10, font, color: muted })
  textRight(sub, right, 10, font, ink)
  if (invoice.discount) {
    y -= 16
    const discLabel = String(invoice.discountLabel || 'Diskon')
    const discAmount = `- ${formatInvoiceIDR(invoice.discount)}`
    page.drawText(discLabel, { x: 330, y, size: 10, font, color: muted })
    textRight(discAmount, right, 10, font, muted)
  }
  if (invoice.downPayment) {
    y -= 16
    const dpLabel = String(invoice.downPaymentLabel || 'Uang muka (DP)')
    const dpAmount = `- ${formatInvoiceIDR(invoice.downPayment)}`
    page.drawText(dpLabel, { x: 330, y, size: 10, font, color: muted })
    textRight(dpAmount, right, 10, font, muted)
  }
  y -= 18
  const totalLabel = invoiceTotalLabel(invoice)
  const total = formatInvoiceIDR(invoice.total)
  page.drawText(totalLabel, { x: 330, y, size: 11, font: fontBold, color: ink })
  textRight(total, right, 11, fontBold, ink)

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

async function buildOfficialInvoicePdf(invoice) {
  const doc = await PDFDocument.create()
  const font = await doc.embedFont(StandardFonts.Helvetica)
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold)
  const fontItalic = await doc.embedFont(StandardFonts.HelveticaOblique)
  const ink = rgb(0.12, 0.14, 0.16)
  const muted = rgb(0.4, 0.42, 0.45)
  const line = rgb(0.75, 0.76, 0.78)
  const left = 48
  const right = 547
  const pageWidth = 595.28
  const pageHeight = 841.89
  const bottom = 52
  const colNo = left
  const colName = left + 28
  const colQty = 318
  const colUnit = 365
  const colPrice = 410

  let page = doc.addPage([pageWidth, pageHeight])
  let y = 780

  function newPage() {
    page = doc.addPage([pageWidth, pageHeight])
    y = 780
  }

  function ensure(space) {
    if (y < bottom + space) newPage()
  }

  function textRight(str, xRight, size, usedFont, color) {
    page.drawText(str, {
      x: xRight - usedFont.widthOfTextAtSize(str, size),
      y,
      size,
      font: usedFont,
      color
    })
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
      for (const w of wrapText(font, row, 9, 300)) {
        page.drawText(w, { x: textLeft, y: infoY, size: 9, font, color: muted })
        infoY -= 12
      }
    }
  }
  if (invoice.business.phone) {
    page.drawText(String(invoice.business.phone), { x: textLeft, y: infoY, size: 9, font, color: muted })
    infoY -= 12
  }

  const noLabel = `No. ${invoice.invoiceNumber || ''}`
  textRight(noLabel, right, 10, fontBold, ink)
  y -= 14
  textRight(formatInvoiceDate(invoice.date), right, 9, font, muted)
  y -= 13
  const statusParts = [invoice.paymentStatusLabel, invoice.paymentMethodLabel].filter(Boolean)
  if (statusParts.length) textRight(statusParts.join(' · '), right, 9, font, muted)
  if (invoice.paidAt) {
    y -= 13
    textRight(`Dibayar ${formatInvoiceDate(invoice.paidAt)}`, right, 9, font, muted)
  }

  y = Math.min(infoY, y) - 18
  page.drawLine({ start: { x: left, y }, end: { x: right, y }, thickness: 1.5, color: ink })
  y -= 28

  const official = invoice.official || {}
  const title = String(official.title || INVOICE_OFFICIAL_DEFAULTS.title)
  page.drawText(title, {
    x: Math.max(left, (pageWidth - fontBold.widthOfTextAtSize(title, 13)) / 2),
    y,
    size: 13,
    font: fontBold,
    color: ink
  })
  y -= 16
  if (invoice.title) {
    const job = String(invoice.title)
    page.drawText(job, {
      x: Math.max(left, (pageWidth - font.widthOfTextAtSize(job, 9)) / 2),
      y,
      size: 9,
      font,
      color: muted
    })
    y -= 18
  } else {
    y -= 6
  }

  page.drawText('Kepada Yth.', { x: left, y, size: 10, font, color: muted })
  y -= 13
  page.drawText(String(invoice.customerName || 'Pelanggan'), { x: left, y, size: 11, font: fontBold, color: ink })
  y -= 13
  page.drawText('di tempat', { x: left, y, size: 10, font, color: muted })
  y -= 22
  const greeting = String(official.greeting || INVOICE_OFFICIAL_DEFAULTS.greeting)
  for (const row of wrapParagraphs(font, greeting, 10, right - left)) {
    ensure(16)
    if (row) page.drawText(row, { x: left, y, size: 10, font, color: ink })
    y -= 13
  }
  y -= 4
  const intro = String(official.intro || INVOICE_OFFICIAL_DEFAULTS.intro)
  for (const row of wrapParagraphs(font, intro, 10, right - left)) {
    ensure(16)
    if (row) page.drawText(row, { x: left, y, size: 10, font, color: ink })
    y -= 13
  }
  y -= 8

  function drawOfficialHeader() {
    page.drawLine({ start: { x: left, y }, end: { x: right, y }, thickness: 0.8, color: ink })
    y -= 16
    page.drawText('NO', { x: colNo, y, size: 8, font: fontBold, color: muted })
    page.drawText('URAIAN', { x: colName, y, size: 8, font: fontBold, color: muted })
    page.drawText('QTY', { x: colQty, y, size: 8, font: fontBold, color: muted })
    page.drawText('SAT.', { x: colUnit, y, size: 8, font: fontBold, color: muted })
    page.drawText('HARGA', { x: colPrice, y, size: 8, font: fontBold, color: muted })
    textRight('JUMLAH', right, 8, fontBold, muted)
    y -= 8
    page.drawLine({ start: { x: left, y }, end: { x: right, y }, thickness: 0.5, color: line })
    y -= 14
  }

  drawOfficialHeader()

  const sections = invoiceSections(invoice)
  if (!sections.length) {
    page.drawText('Belum ada item.', { x: left, y, size: 10, font, color: muted })
    y -= 18
  }

  let itemNo = 0
  for (const section of sections) {
    if (section.title) {
      if (y < bottom + 130) {
        newPage()
        drawOfficialHeader()
      }
      page.drawText(String(section.title).toUpperCase(), { x: left, y, size: 8, font: fontBold, color: muted })
      y -= 14
    }
    for (const item of section.items) {
      itemNo += 1
      const nameBits = [item.name]
      if (item.lineType === 'service') nameBits.push('Jasa')
      if (item.note) nameBits.push(item.note)
      const nameLines = wrapText(font, nameBits.join(' · '), 10, 250)
      const rowH = Math.max(nameLines.length, 1) * 12 + 8
      if (y - rowH < bottom + 110) {
        newPage()
        drawOfficialHeader()
      }
      page.drawText(String(itemNo), { x: colNo, y, size: 10, font, color: muted })
      for (const [i, row] of nameLines.entries()) {
        page.drawText(row, { x: colName, y: y - i * 12, size: 10, font, color: ink })
      }
      page.drawText(invoiceItemQty(item), { x: colQty, y, size: 10, font, color: ink })
      page.drawText(invoiceItemUnit(item), { x: colUnit, y, size: 10, font, color: muted })
      page.drawText(formatInvoiceIDR(item.unitPrice), { x: colPrice, y, size: 10, font, color: ink })
      textRight(formatInvoiceIDR(item.amount), right, 10, font, ink)
      y -= rowH
    }
  }

  ensure(90)
  page.drawLine({ start: { x: left, y }, end: { x: right, y }, thickness: 1, color: ink })
  y -= 18
  page.drawText('Subtotal', { x: 330, y, size: 10, font, color: muted })
  textRight(formatInvoiceIDR(invoice.subtotal), right, 10, font, ink)
  if (invoice.discount) {
    y -= 16
    page.drawText(String(invoice.discountLabel || 'Diskon'), { x: 330, y, size: 10, font, color: muted })
    textRight(`- ${formatInvoiceIDR(invoice.discount)}`, right, 10, font, muted)
  }
  if (invoice.downPayment) {
    y -= 16
    page.drawText(String(invoice.downPaymentLabel || 'Uang muka (DP)'), { x: 330, y, size: 10, font, color: muted })
    textRight(`- ${formatInvoiceIDR(invoice.downPayment)}`, right, 10, font, muted)
  }
  y -= 18
  page.drawText(invoiceTotalLabel(invoice), { x: 330, y, size: 11, font: fontBold, color: ink })
  textRight(formatInvoiceIDR(invoice.total), right, 11, fontBold, ink)
  y -= 20
  const said = `Terbilang: ${terbilangRupiah(invoice.total)}`
  for (const row of wrapText(fontItalic, said, 9, right - left)) {
    ensure(14)
    page.drawText(row, { x: left, y, size: 9, font: fontItalic, color: ink })
    y -= 12
  }

  y -= 10
  page.drawText('Keterangan', { x: left, y, size: 9, font: fontBold, color: muted })
  y -= 14
  const notes = [
    ...(Array.isArray(official.terms) && official.terms.length
      ? official.terms
      : INVOICE_OFFICIAL_DEFAULTS.terms.split('\n').filter(Boolean)),
    ...(invoice.notes ? [String(invoice.notes)] : [])
  ]
  for (const note of notes) {
    for (const row of wrapText(font, `• ${note}`, 9, right - left)) {
      ensure(14)
      page.drawText(row, { x: left, y, size: 9, font, color: ink })
      y -= 12
    }
  }

  y -= 8
  const closing = String(official.closing || INVOICE_OFFICIAL_DEFAULTS.closing)
  for (const row of wrapParagraphs(font, closing, 10, right - left)) {
    ensure(16)
    if (row) page.drawText(row, { x: left, y, size: 10, font, color: ink })
    y -= 13
  }

  const footer = String(invoice.business.footer || '')
  if (footer) {
    y -= 6
    for (const row of wrapParagraphs(font, footer, 9, right - left)) {
      ensure(14)
      if (row) page.drawText(row, { x: left, y, size: 9, font, color: muted })
      y -= 12
    }
  }

  ensure(90)
  y -= 18
  const signX = 360
  const signOff = String(official.signOff || INVOICE_OFFICIAL_DEFAULTS.signOff)
  for (const row of wrapParagraphs(font, signOff, 10, 180)) {
    if (row) page.drawText(row, { x: signX, y, size: 10, font, color: ink })
    y -= 13
  }
  page.drawText(String(official.signer || invoice.business.name || 'OCN'), {
    x: signX,
    y,
    size: 10,
    font: fontBold,
    color: ink
  })
  y -= 56
  page.drawLine({ start: { x: signX, y }, end: { x: signX + 150, y }, thickness: 0.5, color: line })
  y -= 12
  page.drawText(String(official.signHint || INVOICE_OFFICIAL_DEFAULTS.signHint), {
    x: signX,
    y,
    size: 8,
    font,
    color: muted
  })

  return doc.save()
}

export function invoicePdfFilename(invoice) {
  const raw = String(invoice?.invoiceNumber || 'invoice').replace(/[^\w.-]+/g, '_')
  return `${raw}.pdf`
}
