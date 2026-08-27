import { useDb } from '../../db/index.js'
import { searchCatalogItems } from '../../utils/supplierCatalog.js'

export default defineEventHandler(async (event) => {
  const q = getQuery(event)
  const term = String(q.q || '').trim()
  const sheetKey = String(q.sheetKey || '').trim()
  const category = String(q.category || '').trim()
  const page = Math.max(Number(q.page) || 1, 1)
  const pageSize = Math.min(Math.max(Number(q.pageSize) || 30, 1), 100)

  if (!sheetKey && !category && term.length < 2) {
    return { items: [], total: 0, page, pageSize, categories: [] }
  }

  const db = useDb()
  const result = await searchCatalogItems(db, {
    q: term,
    sheetKey,
    category,
    limit: pageSize,
    offset: (page - 1) * pageSize
  })
  return { ...result, page, pageSize }
})
