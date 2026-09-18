import { and, eq, gte, lte, sql } from 'drizzle-orm'
import { useDb, schema } from '../db/index.js'
import { localDateStr, addDaysYmd, diffDaysYmd, toDateStr } from './dates.js'
import { calendarEventKindLabel } from './calendarEvent.js'
import { normalizeProductStatus } from './projectStatus.js'
import { formatInvoiceIDR } from './invoice.js'
import { saleSettled } from './salePayment.js'

function ymd(value) {
  return toDateStr(value)
}

export function listReminderItems({ events, products, sales, today }) {
  const day = today || localDateStr()
  const tomorrow = addDaysYmd(day, 1)
  const items = []

  for (const row of events || []) {
    const date = ymd(row.date)
    if (date !== day && date !== tomorrow) continue
    const kindLabel = calendarEventKindLabel[row.kind] || 'Jadwal'
    const who = String(row.customerName || '').trim()
    const when = date === day ? 'Hari ini' : 'Besok'
    items.push({
      id: `calendar:${row.id}:${date}`,
      kind: 'calendar',
      entityId: row.id,
      tag: `calendar:${row.id}:${date}`,
      title: `${when}: ${kindLabel}`,
      body: [row.title, who].filter(Boolean).join(' · '),
      url: '/calendar',
      day: date,
      urgent: date === day
    })
  }

  for (const row of products || []) {
    const status = normalizeProductStatus(row.status)
    if (status === 'done' || status === 'pending') continue
    const date = ymd(row.plannedStartDate)
    if (date !== day && date !== tomorrow) continue
    const who = String(row.customerName || '').trim()
    const when = date === day ? 'Hari ini' : 'Besok'
    items.push({
      id: `project:${row.id}:${date}`,
      kind: 'project',
      entityId: row.id,
      tag: `project:${row.id}:${date}`,
      title: `${when}: rencana proyek`,
      body: [row.name, who].filter(Boolean).join(' · '),
      url: `/projects/${row.id}`,
      day: date,
      urgent: date === day
    })
  }

  for (const row of sales || []) {
    if (row.paymentStatus !== 'unpaid') continue
    const due = ymd(row.dueDate)
    if (!due || due > day) continue
    const settled = saleSettled(row)
    const invoice = row.invoiceNumber || `Penjualan #${row.id}`
    const who = String(row.customerName || row.productName || '').trim()
    const overdueDays = Math.max(diffDaysYmd(due, day), 0)
    const title = overdueDays > 0 ? `Tagihan telat ${overdueDays} hari` : 'Tagihan jatuh tempo hari ini'
    items.push({
      id: `invoice:${row.id}:${day}`,
      kind: 'invoice',
      entityId: row.id,
      tag: `invoice:${row.id}:${day}`,
      title,
      body: [invoice, who, formatInvoiceIDR(settled.due)].filter(Boolean).join(' · '),
      url: `/sales/${row.id}/invoice`,
      day,
      urgent: true
    })
  }

  items.sort((a, b) => Number(b.urgent) - Number(a.urgent) || String(a.title).localeCompare(String(b.title), 'id'))
  return items
}

export async function loadReminderItems(today = localDateStr()) {
  const db = useDb()
  const from = addDaysYmd(today, -1)
  const to = addDaysYmd(today, 1)
  const [events, products, sales] = await Promise.all([
    db
      .select({
        id: schema.calendarEvents.id,
        date: schema.calendarEvents.date,
        kind: schema.calendarEvents.kind,
        title: schema.calendarEvents.title,
        customerName: schema.calendarEvents.customerName
      })
      .from(schema.calendarEvents)
      .where(and(gte(schema.calendarEvents.date, from), lte(schema.calendarEvents.date, to))),
    db
      .select({
        id: schema.products.id,
        name: schema.products.name,
        status: schema.products.status,
        plannedStartDate: schema.products.plannedStartDate,
        customerName: schema.products.customerName
      })
      .from(schema.products),
    db
      .select({
        id: schema.sales.id,
        invoiceNumber: schema.sales.invoiceNumber,
        customerName: sql`coalesce(${schema.sales.customerName}, ${schema.customOrders.customerName}, ${schema.products.name})`.as(
          'customerName'
        ),
        productName: schema.products.name,
        paymentStatus: schema.sales.paymentStatus,
        dueDate: schema.sales.dueDate,
        quantity: schema.sales.quantity,
        salePricePerUnit: schema.sales.salePricePerUnit,
        discountAmount: schema.sales.discountAmount,
        downPaymentAmount: schema.sales.downPaymentAmount
      })
      .from(schema.sales)
      .leftJoin(schema.products, eq(schema.sales.productId, schema.products.id))
      .leftJoin(schema.customOrders, eq(schema.sales.customOrderId, schema.customOrders.id))
      .where(eq(schema.sales.paymentStatus, 'unpaid'))
  ])
  return {
    today,
    items: listReminderItems({ events, products, sales, today })
  }
}

async function claimDispatch(db, item, day) {
  try {
    await db.insert(schema.reminderDispatches).values({
      kind: item.kind,
      entityId: item.entityId,
      day
    })
    return true
  } catch (err) {
    const code = String(err?.code || err?.cause?.code || '')
    if (code === '23505') return false
    throw err
  }
}

export function queueReminderDispatch(reason = 'mutation') {
  setTimeout(() => {
    dispatchPushReminders()
      .then((result) => {
        if (result?.sent) {
          console.log(`[OCN] Push pengingat (${reason}): terkirim ${result.sent}`)
        }
      })
      .catch((e) => {
        console.error(`[OCN] Push pengingat gagal (${reason}):`, e.message || e)
      })
  }, 250)
}

export async function dispatchPushReminders() {
  const { sendPushToSubscription, isGonePushError } = await import('./push.js')
  const { today, items } = await loadReminderItems()
  if (!items.length) return { today, sent: 0, skipped: 0, failed: 0 }
  const db = useDb()
  const subs = await db.select().from(schema.pushSubscriptions)
  if (!subs.length) return { today, sent: 0, skipped: items.length, failed: 0 }

  let sent = 0
  let skipped = 0
  let failed = 0
  for (const item of items) {
    const claimed = await claimDispatch(db, item, today)
    if (!claimed) {
      skipped += 1
      continue
    }
    const payload = {
      title: item.title,
      body: item.body,
      url: item.url,
      tag: item.tag
    }
    let itemSent = 0
    for (const sub of subs) {
      try {
        await sendPushToSubscription(sub, payload)
        sent += 1
        itemSent += 1
      } catch (err) {
        failed += 1
        if (isGonePushError(err)) {
          await db.delete(schema.pushSubscriptions).where(eq(schema.pushSubscriptions.id, sub.id))
        }
      }
    }
    if (!itemSent) {
      await db
        .delete(schema.reminderDispatches)
        .where(
          and(
            eq(schema.reminderDispatches.kind, item.kind),
            eq(schema.reminderDispatches.entityId, item.entityId),
            eq(schema.reminderDispatches.day, today)
          )
        )
    }
  }
  return { today, sent, skipped, failed }
}
