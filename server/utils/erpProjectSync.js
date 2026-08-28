import { eq } from 'drizzle-orm'
import { useDb, schema } from '../db/index.js'
import { parseYmd } from './projectStatus.js'

function ymdFromApi(value) {
  return parseYmd(value)
}

export function mapErpProject(item) {
  const name = String(item?.name || '').trim()
  const erpProjectId = String(item?.id || '').trim()
  if (!name || !erpProjectId) return null
  const customerName = String(item.client_name || '').trim() || null
  const contact = String(item.client_contact || '').trim()
  const startedAt = ymdFromApi(item.started_at)
  const completedAt = ymdFromApi(item.finished_at) || startedAt
  return {
    erpProjectId,
    name,
    customerName,
    description: contact || customerName,
    status: 'done',
    startedAt,
    completedAt,
    plannedStartDate: startedAt
  }
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
    if (existing) {
      await db
        .update(schema.products)
        .set({
          name: mapped.name,
          customerName: mapped.customerName,
          description: mapped.description,
          status: 'done',
          startedAt: mapped.startedAt,
          completedAt: mapped.completedAt,
          plannedStartDate: mapped.plannedStartDate
        })
        .where(eq(schema.products.id, existing.id))
      updated += 1
    } else {
      await db.insert(schema.products).values(mapped)
      created += 1
    }
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
    skipped
  }
}
