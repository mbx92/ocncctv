import { useDb } from '../db/index.js'
import { catalogSheets, catalogSupplierName, lastCatalogSyncedAt } from '../utils/supplierCatalog.js'

export default defineEventHandler(async () => {
  const db = useDb()
  return {
    supplierName: catalogSupplierName(),
    sheets: catalogSheets(),
    lastSyncedAt: await lastCatalogSyncedAt(db)
  }
})
