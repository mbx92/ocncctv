import { and, eq, ilike, or, sql, notInArray, asc, count } from 'drizzle-orm'
import * as schema from '../db/schema.js'
import {
  SUPPLIER_CATALOG_SHEETS,
  findCatalogSheet,
  getSupplierCatalogSettings
} from './supplierCatalogConfig.js'
import { parseCsv } from './supplierCatalogParse.js'
import { catalogDisplayName } from './catalogName.js'

function catalogConfigFromRuntime() {
  try {
    const cfg = useRuntimeConfig()
    return getSupplierCatalogSettings(cfg.supplierCatalog || {})
  } catch {
    return getSupplierCatalogSettings({
      spreadsheetId: process.env.SUPPLIER_CATALOG_SPREADSHEET_ID,
      supplierName: process.env.SUPPLIER_CATALOG_SUPPLIER_NAME
    })
  }
}

export function catalogSheets() {
  return SUPPLIER_CATALOG_SHEETS.map((s) => ({
    key: s.key,
    label: s.label,
    sheetName: s.sheetName,
    gid: s.gid
  }))
}

export function catalogSupplierName() {
  return catalogConfigFromRuntime().supplierName
}

export function mapStoredCatalogItem(row) {
  const item = {
    id: row.id,
    ref: row.ref,
    code: row.code,
    name: row.name,
    category: row.category || '',
    unit: String(row.unit || '').trim() || 'pcs',
    supplierPrice: Number(row.supplierPrice) || 0,
    lastPrice: row.lastPrice == null ? null : Number(row.lastPrice),
    lastSyncedAt: row.lastSyncedAt ? new Date(row.lastSyncedAt).toISOString() : null,
    sheetKey: row.sheetKey,
    sheetLabel: row.sheetLabel,
    supplierName: row.supplierName
  }
  return { ...item, name: catalogDisplayName(item) }
}

export async function lastCatalogSyncedAt(db) {
  const rows = await db
    .select({ value: sql`max(${schema.supplierCatalogItems.lastSyncedAt})` })
    .from(schema.supplierCatalogItems)
  const value = rows[0]?.value
  return value ? new Date(value).toISOString() : null
}

export async function itemsForSheet(db, sheetKey, search = '') {
  if (!findCatalogSheet(sheetKey)) return []
  const table = schema.supplierCatalogItems
  const filters = [eq(table.sheetKey, sheetKey)]
  const q = String(search || '').trim()
  if (q) {
    const term = `%${q.replace(/[%_\\]/g, '\\$&')}%`
    filters.push(or(ilike(table.code, term), ilike(table.name, term), ilike(table.category, term)))
  }
  const rows = await db
    .select()
    .from(table)
    .where(and(...filters))
    .orderBy(asc(table.code))
  return rows.map(mapStoredCatalogItem)
}

export async function searchCatalogItems(db, {
  q = '',
  sheetKey = '',
  category = '',
  limit = 30,
  offset = 0
} = {}) {
  const table = schema.supplierCatalogItems
  const filters = []
  const sheet = String(sheetKey || '').trim()
  if (sheet && findCatalogSheet(sheet)) filters.push(eq(table.sheetKey, sheet))
  const cat = String(category || '').trim()
  if (cat) filters.push(eq(table.category, cat))
  const term = String(q || '').trim()
  if (term) {
    const like = `%${term.replace(/[%_\\]/g, '\\$&')}%`
    filters.push(or(ilike(table.code, like), ilike(table.name, like), ilike(table.category, like)))
  }
  if (!filters.length) {
    return { items: [], total: 0, categories: [] }
  }

  const where = and(...filters)
  const pageSize = Math.min(Math.max(Number(limit) || 30, 1), 100)
  const skip = Math.max(Number(offset) || 0, 0)

  const [[totalRow], rows] = await Promise.all([
    db.select({ total: count() }).from(table).where(where),
    db
      .select()
      .from(table)
      .where(where)
      .orderBy(asc(table.sheetLabel), asc(table.code))
      .limit(pageSize)
      .offset(skip)
  ])

  let categories = []
  if (sheet && findCatalogSheet(sheet)) {
    const catRows = await db
      .selectDistinct({ category: table.category })
      .from(table)
      .where(eq(table.sheetKey, sheet))
      .orderBy(asc(table.category))
    categories = catRows.map((r) => r.category).filter(Boolean)
  }

  return {
    items: rows.map(mapStoredCatalogItem),
    total: Number(totalRow?.total || 0),
    categories
  }
}

async function fetchSheetCsv(sheet) {
  const { spreadsheetId } = catalogConfigFromRuntime()
  const url = sheet.gid
    ? `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:csv&gid=${encodeURIComponent(sheet.gid)}`
    : `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheet.sheetName)}`
  const res = await fetch(url, { signal: AbortSignal.timeout(30000) })
  if (!res.ok) {
    throw new Error(`Gagal memuat tab "${sheet.sheetName}" dari Google Sheets.`)
  }
  const body = (await res.text()).trim()
  if (!body) {
    throw new Error(`Tab "${sheet.sheetName}" kosong atau tidak dapat diakses.`)
  }
  return body
}

export async function fetchRemoteItemsForSheet(sheetKey) {
  const sheet = findCatalogSheet(sheetKey)
  if (!sheet) throw new Error(`Tab katalog "${sheetKey}" tidak dikenali.`)
  const csv = await fetchSheetCsv(sheet)
  return parseCsv(csv, sheet, catalogSupplierName())
}

export async function syncSheet(db, sheetKey) {
  const remoteItems = await fetchRemoteItemsForSheet(sheetKey)
  if (!remoteItems.length) {
    throw new Error(`Tab "${sheetKey}" tidak mengembalikan item. Cek SUPPLIER_CATALOG_SPREADSHEET_ID.`)
  }

  const table = schema.supplierCatalogItems
  const syncedAt = new Date()
  const refs = remoteItems.map((item) => item.ref)

  return db.transaction(async (tx) => {
    let created = 0
    let updated = 0

    for (const item of remoteItems) {
      const existing = await tx.select().from(table).where(eq(table.ref, item.ref)).limit(1)
      const row = existing[0]
      if (row) {
        const currentPrice = Number(row.supplierPrice) || 0
        const newPrice = Number(item.supplierPrice) || 0
        await tx
          .update(table)
          .set({
            sheetKey: item.sheetKey,
            sheetLabel: item.sheetLabel,
            supplierName: item.supplierName,
            code: item.code,
            name: item.name,
            category: item.category,
            unit: String(item.unit || '').trim() || 'pcs',
            supplierPrice: newPrice,
            lastPrice: newPrice !== currentPrice ? currentPrice : row.lastPrice,
            lastSyncedAt: syncedAt
          })
          .where(eq(table.ref, item.ref))
        updated++
      } else {
        await tx.insert(table).values({
          ref: item.ref,
          sheetKey: item.sheetKey,
          sheetLabel: item.sheetLabel,
          supplierName: item.supplierName,
          code: item.code,
          name: item.name,
          category: item.category,
          unit: String(item.unit || '').trim() || 'pcs',
          supplierPrice: item.supplierPrice,
          lastPrice: null,
          lastSyncedAt: syncedAt
        })
        created++
      }
    }

    const deleted = await tx
      .delete(table)
      .where(and(eq(table.sheetKey, sheetKey), notInArray(table.ref, refs)))
      .returning({ ref: table.ref })

    return { created, updated, removed: deleted.length }
  })
}

export async function syncAllSheets(db) {
  const summary = { sheets: 0, created: 0, updated: 0, removed: 0, failed: [] }
  for (const sheet of SUPPLIER_CATALOG_SHEETS) {
    try {
      const result = await syncSheet(db, sheet.key)
      summary.sheets++
      summary.created += result.created
      summary.updated += result.updated
      summary.removed += result.removed
    } catch (e) {
      summary.failed.push(`${sheet.key}: ${e.message || e}`)
    }
  }
  return summary
}
