import pg from 'pg'
import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const rootDir = dirname(fileURLToPath(import.meta.url))
const envPath = join(rootDir, '../.env')
if (!process.env.DATABASE_URL && existsSync(envPath)) {
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq <= 0) continue
    const key = trimmed.slice(0, eq).trim()
    let value = trimmed.slice(eq + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    if (key && process.env[key] === undefined) process.env[key] = value
  }
}

// Migrator sendiri (bukan drizzle migrate default): tiap file migrasi di-commit
// terpisah. Default drizzle membungkus SEMUA migrasi pending dalam 1 transaksi,
// sehingga `ALTER TYPE ... ADD VALUE` + pemakaian nilai baru (SET DEFAULT) gagal
// dengan "unsafe use of new value".

const url = process.env.DATABASE_URL
if (!url) {
  console.error('DATABASE_URL wajib diisi')
  process.exit(1)
}

const migrationsFolder = join(rootDir, '../server/db/migrations')
const journalPath = join(migrationsFolder, 'meta/_journal.json')
if (!existsSync(journalPath)) {
  console.error('Tidak menemukan meta/_journal.json')
  process.exit(1)
}

const journal = JSON.parse(readFileSync(journalPath, 'utf8'))
const pool = new pg.Pool({ connectionString: url })
const client = await pool.connect()

try {
  await client.query('CREATE SCHEMA IF NOT EXISTS drizzle')
  await client.query(`
    CREATE TABLE IF NOT EXISTS drizzle.__drizzle_migrations (
      id SERIAL PRIMARY KEY,
      hash text NOT NULL,
      created_at bigint
    )
  `)

  const { rows: applied } = await client.query(
    'SELECT hash, created_at FROM drizzle.__drizzle_migrations'
  )
  const appliedWhen = new Set(applied.map((row) => Number(row.created_at)))

  for (const entry of journal.entries) {
    if (appliedWhen.has(entry.when)) continue

    const migrationPath = join(migrationsFolder, `${entry.tag}.sql`)
    if (!existsSync(migrationPath)) {
      throw new Error(`File migrasi tidak ada: ${migrationPath}`)
    }

    const query = readFileSync(migrationPath, 'utf8')
    const statements = query
      .split('--> statement-breakpoint')
      .map((s) => s.trim())
      .filter(Boolean)
    const hash = createHash('sha256').update(query).digest('hex')

    console.log(`[OCN] Migrasi ${entry.tag}…`)
    await client.query('BEGIN')
    try {
      for (const stmt of statements) {
        await client.query(stmt)
      }
      await client.query(
        'INSERT INTO drizzle.__drizzle_migrations ("hash", "created_at") VALUES ($1, $2)',
        [hash, entry.when]
      )
      await client.query('COMMIT')
    } catch (e) {
      await client.query('ROLLBACK')
      throw e
    }
  }

  console.log('[OCN] Migrasi database selesai')
} catch (e) {
  console.error('[OCN] Migrasi gagal:', e.message || e)
  process.exitCode = 1
} finally {
  client.release()
  await pool.end()
}
