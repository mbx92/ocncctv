import { eq } from 'drizzle-orm'
import { useDb, schema } from '../db/index.js'
import { getSettings, presentSettings } from '../utils/settings.js'
import { requireAdmin } from '../utils/rbac.js'
import { logAudit } from '../utils/audit.js'
import { clampShareTtlDays } from '../utils/invoice.js'

export default defineEventHandler(async (event) => {
  requireAdmin(event)
  const body = await readBody(event)
  const current = await getSettings()
  const db = useDb()
  const patch = {
    electricityRatePerKwh: current.electricityRatePerKwh,
    machineUsageHoursPerMonth: current.machineUsageHoursPerMonth,
    defaultMarginPercent: Math.min(Math.max(Number(body.defaultMarginPercent) || 40, 0), 95),
    salePriceRounding: [0, 100, 500, 1000, 5000].includes(Math.round(Number(body.salePriceRounding)))
      ? Math.round(Number(body.salePriceRounding))
      : 500,
    invoiceBusinessName: String(body.invoiceBusinessName || '').trim() || 'OCN',
    invoiceAddress: String(body.invoiceAddress || '').trim() || null,
    invoicePhone: String(body.invoicePhone || '').trim() || null,
    invoiceFooter: String(body.invoiceFooter || '').replace(/\r\n/g, '\n').trim() || null,
    rabFooter: String(body.rabFooter || '').replace(/\r\n/g, '\n').trim() || null,
    invoiceShareTtlDays: clampShareTtlDays(body.invoiceShareTtlDays)
  }
  if (Object.prototype.hasOwnProperty.call(body, 'erpSyncBaseUrl')) {
    patch.erpSyncBaseUrl = String(body.erpSyncBaseUrl || '').trim() || null
  }
  const nextKey = String(body.erpSyncApiKey || '').trim()
  if (nextKey) patch.erpSyncApiKey = nextKey
  const rows = await db
    .update(schema.appSettings)
    .set(patch)
    .where(eq(schema.appSettings.id, current.id))
    .returning()
  await logAudit(event, { action: 'update', entity: 'settings', entityId: current.id, summary: 'Ubah pengaturan' })
  return presentSettings(rows[0])
})
