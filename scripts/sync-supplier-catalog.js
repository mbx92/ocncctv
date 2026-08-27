import 'dotenv/config'
import pg from 'pg'
import { drizzle } from 'drizzle-orm/node-postgres'
import * as schema from '../server/db/schema.js'
import { lastCatalogSyncedAt, syncAllSheets } from '../server/utils/supplierCatalog.js'

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL || 'postgres://mbx@localhost:5432/ocn'
})
const db = drizzle(pool, { schema })

const summary = await syncAllSheets(db)
console.log(
  `[OCN] Sync katalog: ${summary.sheets} tab, ${summary.created} baru, ${summary.updated} diperbarui, ${summary.removed} dihapus.`
)
if (summary.failed.length) {
  console.error('[OCN] Gagal:', summary.failed.join('\n'))
}
const last = await lastCatalogSyncedAt(db)
if (last) console.log('[OCN] Terakhir sync:', last)
await pool.end()
if (summary.sheets === 0 && summary.failed.length) process.exitCode = 1
