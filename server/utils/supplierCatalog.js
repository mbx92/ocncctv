import { and, eq, ilike, or, sql, notInArray, asc, count } from 'drizzle-orm'
import * as schema from '../db/schema.js'
import {
  SUPPLIER_CATALOG_SHEETS,
  findCatalogSheet,
  getSupplierCatalogSettings
} from './supplierCatalogConfig.js'
import { parseCsv, csvIsInventoryDump, parseInventoryItems, uniqueCategoryCount } from './supplierCatalogParse.js'
import { catalogDisplayName } from './catalogName.js'
import { cableRollInfo } from './cableRoll.js'
import {
  discoverLiveSheets,
  fetchSpreadsheetCsv,
  filterDumpForSheet,
  matchLiveSheet
} from './supplierCatalogDiscover.js'

function withCableRoll(item) {
  const roll = cableRollInfo(item)
  if (!roll) return item
  return {
    ...item,
    unit: item.unit && item.unit !== 'pcs' ? item.unit : 'roll',
    contentQty: roll.metersPerRoll,
    metersPerRoll: roll.metersPerRoll,
    pricePerMeter: roll.pricePerMeter,
    purchaseUnit: roll.purchaseUnit
  }
}

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
    contentQty: row.contentQty == null ? null : Number(row.contentQty) || null,
    supplierPrice: Number(row.supplierPrice) || 0,
    lastPrice: row.lastPrice == null ? null : Number(row.lastPrice),
    lastSyncedAt: row.lastSyncedAt ? new Date(row.lastSyncedAt).toISOString() : null,
    sheetKey: row.sheetKey,
    sheetLabel: row.sheetLabel,
    supplierName: row.supplierName,
    source: 'database'
  }
  return withCableRoll({ ...item, name: catalogDisplayName(item) })
}

export function mapRemoteCatalogItem(item) {
  const row = {
    id: null,
    ref: item.ref,
    code: item.code,
    name: item.name,
    category: item.category || '',
    unit: String(item.unit || '').trim() || 'pcs',
    contentQty: item.contentQty == null ? null : Number(item.contentQty) || null,
    supplierPrice: Number(item.supplierPrice) || 0,
    lastPrice: null,
    lastSyncedAt: null,
    sheetKey: item.sheetKey,
    sheetLabel: item.sheetLabel,
    supplierName: item.supplierName,
    source: 'remote'
  }
  return withCableRoll({ ...row, name: catalogDisplayName(row) })
}

function filterRemoteCatalogItems(items, { q = '', category = '' } = {}) {
  let list = items
  const cat = String(category || '').trim()
  if (cat) list = list.filter((item) => item.category === cat)
  const term = String(q || '').trim().toLowerCase()
  if (term) {
    list = list.filter((item) =>
      `${item.code} ${item.name} ${item.category}`.toLowerCase().includes(term)
    )
  }
  return list
}

async function remoteCatalogSearch(sheetKey, { q = '', category = '', limit = 30, offset = 0 } = {}) {
  const remote = (await fetchRemoteItemsForSheet(sheetKey)).map(mapRemoteCatalogItem)
  const categories = [...new Set(remote.map((item) => item.category).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b, 'id')
  )
  const filtered = filterRemoteCatalogItems(remote, { q, category })
  const pageSize = Math.min(Math.max(Number(limit) || 30, 1), 100)
  const skip = Math.max(Number(offset) || 0, 0)
  return {
    items: filtered.slice(skip, skip + pageSize),
    total: filtered.length,
    categories,
    source: 'remote'
  }
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

  const total = Number(totalRow?.total || 0)
  if (total === 0 && sheet && findCatalogSheet(sheet)) {
    try {
      return await remoteCatalogSearch(sheet, { q: term, category: cat, limit: pageSize, offset: skip })
    } catch {
      return { items: [], total: 0, categories: [], source: 'database' }
    }
  }

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
    total,
    categories,
    source: 'database'
  }
}

function isUsableCatalogItem(item) {
  const code = String(item?.code || '').trim()
  const name = String(item?.name || '').trim()
  if (code.length < 2 || name.length < 2) return false
  if (/kode item/i.test(code) || /nama item/i.test(name)) return false
  return true
}

function remapSheetItems(items, sheet) {
  const seen = new Set()
  const out = []
  for (const item of items || []) {
    const code = String(item.code || '').trim()
    if (!code || seen.has(code)) continue
    seen.add(code)
    out.push({
      ...item,
      ref: `${sheet.key}:${code}`,
      sheetKey: sheet.key,
      sheetLabel: sheet.label,
      supplierName: item.supplierName || catalogSupplierName()
    })
  }
  return out.filter(isUsableCatalogItem)
}

function tabParseLooksSafe(csv, items, sheet) {
  if (!items.length) return false
  if (!csvIsInventoryDump(csv)) return true
  if (sheet.categoryFilter) return uniqueCategoryCount(items) <= 3
  return uniqueCategoryCount(items) <= 3 && items.length <= 400
}

let workspaceCache = { at: 0, value: null }

export async function loadCatalogWorkspace() {
  const { spreadsheetId } = catalogConfigFromRuntime()
  const supplierName = catalogSupplierName()
  const [liveSheets, dumpCsv] = await Promise.all([
    discoverLiveSheets(spreadsheetId).catch(() => []),
    fetchSpreadsheetCsv(spreadsheetId, { gid: '0' }).catch(() => '')
  ])
  const dumpItems = dumpCsv ? parseInventoryItems(dumpCsv, supplierName) : []
  return { spreadsheetId, supplierName, liveSheets, dumpItems }
}

export async function getCatalogWorkspace() {
  if (workspaceCache.value && Date.now() - workspaceCache.at < 60_000) return workspaceCache.value
  const value = await loadCatalogWorkspace()
  workspaceCache = { at: Date.now(), value }
  return value
}

function clearCatalogWorkspaceCache() {
  workspaceCache = { at: 0, value: null }
}

export async function itemsForConfiguredSheet(sheet, workspace) {
  const live = matchLiveSheet(sheet, workspace?.liveSheets || [])
  if (live) {
    const csv = await fetchSpreadsheetCsv(workspace.spreadsheetId, { gid: live.gid, sheetName: live.name })
    if (csv) {
      const parsed = remapSheetItems(parseCsv(csv, { ...sheet, gid: live.gid, sheetName: live.name }, workspace.supplierName), sheet)
      if (tabParseLooksSafe(csv, parsed, sheet)) {
        return { items: parsed, source: 'tab' }
      }
    }
  }

  const fromDump = remapSheetItems(filterDumpForSheet(workspace?.dumpItems || [], sheet), sheet)
  if (fromDump.length) return { items: fromDump, source: 'inventory' }
  return { items: [], source: 'none' }
}

export async function fetchRemoteItemsForSheet(sheetKey) {
  const sheet = findCatalogSheet(sheetKey)
  if (!sheet) throw new Error(`Tab katalog "${sheetKey}" tidak dikenali.`)
  const workspace = await getCatalogWorkspace()
  const { items } = await itemsForConfiguredSheet(sheet, workspace)
  return items
}

export async function syncSheet(db, sheetKey, workspace = null) {
  const sheet = findCatalogSheet(sheetKey)
  if (!sheet) {
    return { created: 0, updated: 0, removed: 0, skipped: true, reason: 'unknown', source: 'none' }
  }
  const ws = workspace || (await getCatalogWorkspace())
  const { items, source } = await itemsForConfiguredSheet(sheet, ws)
  const remoteItems = remapSheetItems(items, sheet)
  if (!remoteItems.length) {
    return { created: 0, updated: 0, removed: 0, skipped: true, reason: 'empty', source }
  }

  const table = schema.supplierCatalogItems
  const [{ total: existingCount }] = await db
    .select({ total: count() })
    .from(table)
    .where(eq(table.sheetKey, sheetKey))
  const previous = Number(existingCount) || 0
  if (previous >= 20 && remoteItems.length < Math.max(3, Math.ceil(previous * 0.15))) {
    return { created: 0, updated: 0, removed: 0, skipped: true, reason: 'drop', source }
  }

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
            contentQty: item.contentQty == null ? null : Number(item.contentQty) || null,
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
          contentQty: item.contentQty == null ? null : Number(item.contentQty) || null,
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

    return { created, updated, removed: deleted.length, skipped: false, source }
  })
}

export async function syncAllSheets(db) {
  const summary = { sheets: 0, created: 0, updated: 0, removed: 0, failed: [], skipped: [], filledFromInventory: [] }
  const workspace = await loadCatalogWorkspace()
  workspaceCache = { at: Date.now(), value: workspace }
  try {
    for (const sheet of SUPPLIER_CATALOG_SHEETS) {
      try {
        const result = await syncSheet(db, sheet.key, workspace)
        if (result.skipped) {
          summary.skipped.push(`${sheet.key}:${result.reason}`)
          continue
        }
        summary.sheets++
        summary.created += result.created
        summary.updated += result.updated
        summary.removed += result.removed
        if (result.source === 'inventory') summary.filledFromInventory.push(sheet.key)
      } catch (e) {
        summary.failed.push(`${sheet.key}: ${e.message || e}`)
      }
    }
    return summary
  } finally {
    clearCatalogWorkspaceCache()
  }
}
