export const invoiceSectionTitle = {
  rab: 'Item RAB',
  extra: 'Tambahan / penggantian'
}

export function invoiceLineType(line) {
  return line.lineType === 'service' ? 'service' : line.lineType === 'product' ? 'product' : 'catalog'
}

export function billedInvoiceLines(lines) {
  return (lines || []).filter((line) => !line.omitted && Math.max(Math.round(Number(line.quantity) || 0), 0) > 0)
}

function invoiceMergeKey(line, unitPrice) {
  const unit = String(line.unit || '').trim()
  if (line.lineType === 'service') {
    if (line.serviceId) return `service:${line.serviceId}:${unit}:${unitPrice}`
    return `service:${String(line.name || '').trim().toLowerCase()}:${unit}:${unitPrice}`
  }
  if (line.lineType === 'product' && line.packagingId) {
    return `product:${line.packagingId}:${unit}:${unitPrice}`
  }
  if (line.catalogItemId) return `catalog:${line.catalogItemId}:${unit}:${unitPrice}`
  return `name:${invoiceLineType(line)}:${String(line.name || '').trim().toLowerCase()}:${line.code || ''}:${unit}:${unitPrice}`
}

export function itemsFromProjectLines(lines, section) {
  const merged = []
  const index = new Map()
  for (const line of billedInvoiceLines(lines)) {
    const quantity = Math.max(Math.round(Number(line.quantity) || 0), 0)
    const originalQuantity = Math.max(Math.round(Number(line.originalQuantity ?? line.quantity) || 0), 0)
    const unitPrice = Math.max(Math.round(Number(line.salePrice) || 0), 0)
    const key = invoiceMergeKey(line, unitPrice)
    const existing = index.get(key)
    if (existing) {
      existing.quantity += quantity
      existing.originalQuantity = Math.max(existing.originalQuantity || 0, originalQuantity)
      existing.amount = existing.quantity * existing.unitPrice
      existing.note = existing.originalQuantity > existing.quantity ? `Qty RAB ${existing.originalQuantity}` : ''
      continue
    }
    const item = {
      name: String(line.name || '').trim() || 'Item',
      code: line.code || '',
      lineType: invoiceLineType(line),
      section,
      quantity,
      originalQuantity,
      note: originalQuantity > quantity ? `Qty RAB ${originalQuantity}` : '',
      unit: String(line.unit || '').trim() || (line.lineType === 'service' ? 'titik' : ''),
      unitPrice,
      amount: quantity * unitPrice
    }
    index.set(key, item)
    merged.push(item)
  }
  return merged
}

export function invoiceSectionsFromItems(items) {
  const list = items || []
  const rab = list.filter((item) => item.section === 'rab')
  const extra = list.filter((item) => item.section === 'extra')
  const other = list.filter((item) => item.section !== 'rab' && item.section !== 'extra')
  return [
    rab.length ? { key: 'rab', title: invoiceSectionTitle.rab, items: rab } : null,
    extra.length ? { key: 'extra', title: invoiceSectionTitle.extra, items: extra } : null,
    other.length ? { key: 'other', title: null, items: other } : null
  ].filter(Boolean)
}

export function buildProjectInvoicePreview({
  product,
  settings,
  rabLines,
  extraLines,
  sale,
  downPayment,
  date
} = {}) {
  const rabItems = itemsFromProjectLines(rabLines, 'rab')
  const extraItems = itemsFromProjectLines(extraLines, 'extra')
  const items = [...rabItems, ...extraItems]
  const sections = invoiceSectionsFromItems(items)
  const subtotal = items.reduce((sum, item) => sum + item.amount, 0)
  const discount = Math.min(Math.max(Math.round(Number(sale?.discountAmount) || 0), 0), subtotal)
  const afterDiscount = Math.max(subtotal - discount, 0)
  const dp = Math.min(Math.max(Math.round(Number(downPayment ?? sale?.downPaymentAmount ?? product?.downPaymentTotal) || 0), 0), afterDiscount)
  const paid = sale?.paymentStatus === 'paid'
  const customerName =
    String(sale?.customerName || product?.rab?.customerName || product?.customerName || '').trim() || '—'
  const title = String(product?.name || '').trim() || null
  const businessName = settings?.invoiceBusinessName || 'OCN'
  const discountKind = sale?.discountKind === 'percent' ? 'percent' : 'amount'
  const discountPercent = Math.min(Math.max(Number(sale?.discountPercent) || 0, 0), 100)
  return {
    id: sale?.id || null,
    preview: !sale?.invoiceNumber,
    invoiceNumber: sale?.invoiceNumber || 'Preview',
    date: sale?.date || date || null,
    title,
    customerName,
    paymentStatus: paid ? 'paid' : 'unpaid',
    paymentStatusLabel: paid ? 'Lunas' : 'Belum dibayar',
    paymentMethod: paid ? sale?.paymentMethod || null : null,
    paymentMethodLabel: null,
    paidAt: paid ? sale?.paidAt || null : null,
    notes: sale?.notes || product?.rab?.notes || null,
    items,
    item: items[0] || null,
    sections,
    subtotal,
    discount,
    discountKind,
    discountPercent,
    discountLabel:
      discount > 0 ? (discountKind === 'percent' ? `Diskon ${discountPercent}%` : 'Diskon') : null,
    downPayment: dp,
    downPaymentLabel: dp > 0 ? 'Uang muka (DP)' : null,
    dueDate: sale?.dueDate || null,
    total: afterDiscount - dp,
    business: {
      name: businessName,
      address: settings?.invoiceAddress || null,
      phone: settings?.invoicePhone || null,
      footer: settings?.invoiceFooter || 'Terima kasih telah berbelanja.'
    }
  }
}
