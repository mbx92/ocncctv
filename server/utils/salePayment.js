import { sanitizeText } from './sanitizeText.js'
import { parseYmd } from './projectStatus.js'
import { addDaysYmd } from './dates.js'

const METHODS = ['cash', 'transfer', 'other']

export function defaultPaymentStatus() {
  return 'paid'
}

export function defaultPaymentMethod(status) {
  if (status !== 'paid') return null
  return 'cash'
}

export function afterFeeOf(row) {
  const qty = Math.max(Math.round(Number(row?.quantity) || 0), 0)
  const price = Math.max(Math.round(Number(row?.salePricePerUnit) || 0), 0)
  return price * qty
}

export function resolveDiscount(body, afterFee) {
  const cap = Math.max(Math.round(Number(afterFee) || 0), 0)
  const kind = body.discountKind === 'percent' ? 'percent' : 'amount'
  if (kind === 'percent') {
    const percent = Math.min(Math.max(Number(body.discountPercent) || 0, 0), 100)
    return {
      discountKind: 'percent',
      discountPercent: percent,
      discountAmount: Math.round(cap * (percent / 100))
    }
  }
  const amount = Math.min(Math.max(Math.round(Number(body.discountAmount) || 0), 0), cap)
  return {
    discountKind: 'amount',
    discountPercent: cap ? Math.round((amount / cap) * 1000) / 10 : 0,
    discountAmount: amount
  }
}

export function resolveDueDate({ dueDate, paymentStatus, saleDate, existingDueDate }) {
  if (paymentStatus === 'paid') return existingDueDate || null
  if (dueDate === null || dueDate === '') return null
  const parsed = parseYmd(dueDate)
  if (parsed) return parsed
  if (existingDueDate) return existingDueDate
  const base = parseYmd(saleDate)
  return base ? addDaysYmd(base, 7) : null
}

export function parseSalePayment(body, _channel, saleDate, moneySource) {
  const status =
    body.paymentStatus === 'paid' || body.paymentStatus === 'unpaid'
      ? body.paymentStatus
      : defaultPaymentStatus()
  const methodRaw = String(body.paymentMethod || '')
  const normalized = methodRaw === 'marketplace' ? 'other' : methodRaw
  const paymentMethod = METHODS.includes(normalized) ? normalized : defaultPaymentMethod(status)
  const paidAt = status === 'paid' ? String(body.paidAt || saleDate || '').slice(0, 10) || null : null
  const parsed = {
    paymentStatus: status,
    paymentMethod: status === 'paid' ? paymentMethod : null,
    paidAt
  }
  const hasDiscount =
    body.discountAmount != null ||
    body.discountPercent != null ||
    body.discountKind === 'amount' ||
    body.discountKind === 'percent'
  if (hasDiscount) {
    Object.assign(parsed, resolveDiscount(body, afterFeeOf(moneySource || body)))
  }
  if (body.paymentNotes != null) {
    parsed.paymentNotes = sanitizeText(String(body.paymentNotes)) || null
  }
  return parsed
}

export function saleMoney({ salePricePerUnit, quantity, discountAmount }) {
  const qty = Math.max(Math.round(Number(quantity) || 0), 0)
  const price = Math.max(Math.round(Number(salePricePerUnit) || 0), 0)
  const gross = price * qty
  const discount = Math.min(Math.max(Math.round(Number(discountAmount) || 0), 0), gross)
  return { gross, fee: 0, discount, net: gross - discount }
}

export function clampDownPayment(amount, cap) {
  const limit = Math.max(Math.round(Number(cap) || 0), 0)
  return Math.min(Math.max(Math.round(Number(amount) || 0), 0), limit)
}

export function saleSettled({ salePricePerUnit, quantity, discountAmount, downPaymentAmount }) {
  const money = saleMoney({ salePricePerUnit, quantity, discountAmount })
  const downPayment = clampDownPayment(downPaymentAmount, money.net)
  return { ...money, downPayment, due: money.net - downPayment }
}
