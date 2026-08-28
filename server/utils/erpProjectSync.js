import { eq } from 'drizzle-orm'
import { useDb, schema } from '../db/index.js'
import { replaceProjectExtraLines } from './projectLines.js'
import { replaceProjectTechnicianWages } from './projectWages.js'

function parseErpDate(value) {
  const raw = String(value || '').slice(0, 10)
  return /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : null
}

export function mapErpProject(item) {
  const name = String(item?.name || '').trim()
  const erpProjectId = String(item?.id || '').trim()
  if (!name || !erpProjectId) return null
  const erpTotalValue = Math.max(Math.round(Number(item?.total_value) || 0), 0)
  const startedAt = parseErpDate(item?.started_at)
  const completedAt = parseErpDate(item?.finished_at)
  const customerName = String(item?.customer_name || '').trim() || null
  return {
    erpProjectId,
    name,
    customerName,
    status: 'pending',
    erpTotalValue,
    startedAt,
    completedAt,
    plannedStartDate: startedAt,
    items: mapErpItems(item?.items),
    wages: mapErpWages(item?.wages)
  }
}

export function mapErpItems(items) {
  return (items || [])
    .map((item) => {
      const name = String(item?.name || '').trim()
      const quantity = Math.max(Math.round(Number(item?.qty) || 0), 0)
      if (!name || quantity <= 0) return null
      const lineType = item?.line_type === 'service' ? 'service' : 'catalog'
      const unit = String(item?.unit || '').trim() || (lineType === 'service' ? 'titik' : 'pcs')
      const salePrice = Math.max(Math.round(Number(item?.unit_price) || 0), 0)
      const costPrice = lineType === 'service' ? 0 : Math.max(Math.round(Number(item?.unit_cost) || 0), 0)
      return {
        lineType,
        catalogItemId: null,
        serviceId: null,
        packagingId: null,
        name,
        code: null,
        unit,
        quantity,
        costPrice,
        salePrice
      }
    })
    .filter(Boolean)
}

export function mapErpWages(wages) {
  return (wages || [])
    .map((row) => {
      const name = String(row?.name || '').trim()
      const amount = Math.max(Math.round(Number(row?.amount) || 0), 0)
      if (!name || amount <= 0) return null
      return { name, amount }
    })
    .filter(Boolean)
}

async function fetchCompletedPage(baseUrl, apiKey, page) {
  let url
  try {
    url = new URL('/api/ocn-cctv/projects', baseUrl)
  } catch {
    const error = new Error('URL ERP tidak valid.')
    error.statusCode = 400
    throw error
  }
  url.searchParams.set('page', String(page))
  url.searchParams.set('per_page', '100')
  let res
  try {
    res = await fetch(url, {
      headers: {
        Accept: 'application/json',
        'X-Api-Key': apiKey
      }
    })
  } catch {
    const error = new Error('Tidak bisa menghubungi ERP. Periksa URL.')
    error.statusCode = 502
    throw error
  }
  const text = await res.text()
  let body = null
  try {
    body = text ? JSON.parse(text) : null
  } catch {
    body = null
  }
  if (!res.ok) {
    const message = body?.message || `ERP HTTP ${res.status}`
    const error = new Error(message)
    error.statusCode = res.status === 401 ? 401 : res.status === 422 ? 422 : 502
    throw error
  }
  return body || { projects: [], meta: { current_page: page, last_page: page } }
}

export async function syncCompletedErpProjects({ baseUrl, apiKey }) {
  if (!baseUrl || !apiKey) {
    const error = new Error('Isi URL ERP dan API key di Pengaturan → Integrasi.')
    error.statusCode = 400
    throw error
  }

  const db = useDb()
  const all = []
  let page = 1
  let lastPage = 1
  let company = null
  do {
    const payload = await fetchCompletedPage(baseUrl, apiKey, page)
    company = payload.company || company
    all.push(...(payload.projects || []))
    lastPage = Number(payload.meta?.last_page) || 1
    page += 1
  } while (page <= lastPage && page <= 50)

  let created = 0
  let updated = 0
  let skipped = 0
  let itemLines = 0
  let wageRows = 0

  for (const raw of all) {
    const mapped = mapErpProject(raw)
    if (!mapped) {
      skipped += 1
      continue
    }
    const [existing] = await db
      .select({ id: schema.products.id })
      .from(schema.products)
      .where(eq(schema.products.erpProjectId, mapped.erpProjectId))
      .limit(1)

    let productId = existing?.id
    const productValues = {
      name: mapped.name,
      customerName: mapped.customerName,
      erpTotalValue: mapped.erpTotalValue || null,
      startedAt: mapped.startedAt,
      completedAt: mapped.completedAt,
      plannedStartDate: mapped.plannedStartDate
    }
    if (productId) {
      await db.update(schema.products).set(productValues).where(eq(schema.products.id, productId))
      updated += 1
    } else {
      const [row] = await db
        .insert(schema.products)
        .values({
          erpProjectId: mapped.erpProjectId,
          status: 'pending',
          ...productValues
        })
        .returning({ id: schema.products.id })
      productId = row.id
      created += 1
    }

    await db.transaction(async (tx) => {
      await replaceProjectExtraLines(tx, schema, productId, mapped.items)
      await replaceProjectTechnicianWages(tx, schema, productId, mapped.wages)
    })
    itemLines += mapped.items.length
    wageRows += mapped.wages.length
  }

  const settings = await db.select({ id: schema.appSettings.id }).from(schema.appSettings).limit(1)
  if (settings[0]) {
    await db
      .update(schema.appSettings)
      .set({ erpSyncLastAt: new Date() })
      .where(eq(schema.appSettings.id, settings[0].id))
  }

  return {
    companyName: company?.name || null,
    fetched: all.length,
    created,
    updated,
    skipped,
    itemLines,
    wageRows
  }
}
