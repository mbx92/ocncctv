import { useDb } from '../../../db/index.js'
import { findCatalogSheet } from '../../../utils/supplierCatalogConfig.js'
import { fetchRemoteItemsForSheet, itemsForSheet, lastCatalogSyncedAt } from '../../../utils/supplierCatalog.js'

export default defineEventHandler(async (event) => {
  const sheetKey = getRouterParam(event, 'sheetKey')
  if (!findCatalogSheet(sheetKey)) {
    throw createError({ statusCode: 404, statusMessage: 'Brand katalog tidak dikenali' })
  }

  const q = getQuery(event).q
  const db = useDb()
  let items = await itemsForSheet(db, sheetKey, q)
  let source = 'database'

  if (!items.length) {
    try {
      items = await fetchRemoteItemsForSheet(sheetKey)
      source = 'remote'
      const term = String(q || '').trim().toLowerCase()
      if (term) {
        items = items.filter((item) =>
          `${item.code} ${item.name} ${item.category}`.toLowerCase().includes(term)
        )
      }
    } catch {
      items = []
    }
  }

  return {
    sheetKey,
    items,
    total: items.length,
    source,
    lastSyncedAt: await lastCatalogSyncedAt(db)
  }
})
