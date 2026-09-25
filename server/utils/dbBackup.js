import pg from 'pg'
import { localDateStr } from './dates.js'

const INSERT_BATCH = 80
const TIMESTAMP_OIDS = new Set([
  pg.types.builtins.DATE,
  pg.types.builtins.TIMESTAMP,
  pg.types.builtins.TIMESTAMPTZ,
  pg.types.builtins.TIME,
  pg.types.builtins.TIMETZ
])

function pad2(n) {
  return String(n).padStart(2, '0')
}

export function backupDumpFilename(date = new Date()) {
  return `ocncctv-${localDateStr(date).replaceAll('-', '')}-${pad2(date.getHours())}${pad2(date.getMinutes())}${pad2(date.getSeconds())}.sql`
}

export function parseDatabaseUrl(raw) {
  const value = String(raw || '').trim()
  if (!value) throw createError({ statusCode: 500, statusMessage: 'DATABASE_URL belum diatur' })
  let u
  try {
    u = new URL(value)
  } catch {
    throw createError({ statusCode: 500, statusMessage: 'DATABASE_URL tidak valid' })
  }
  const database = decodeURIComponent(u.pathname.replace(/^\//, '').split('/')[0] || '')
  if (!u.hostname || !database) {
    throw createError({ statusCode: 500, statusMessage: 'DATABASE_URL tidak lengkap' })
  }
  return {
    host: u.hostname,
    port: u.port || '5432',
    user: decodeURIComponent(u.username || 'postgres'),
    password: decodeURIComponent(u.password || ''),
    database,
    sslmode: u.searchParams.get('sslmode') || 'prefer'
  }
}

function qid(name) {
  return `"${String(name).replace(/"/g, '""')}"`
}

function qrel(schema, name) {
  return `${qid(schema)}.${qid(name)}`
}

function quoteString(value) {
  return `'${String(value).replace(/'/g, "''")}'`
}

function sqlLiteral(value) {
  if (value === null || value === undefined) return 'NULL'
  if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE'
  if (typeof value === 'bigint') return String(value)
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return value === Infinity ? "'Infinity'" : value === -Infinity ? "'-Infinity'" : 'NULL'
    return String(value)
  }
  if (Buffer.isBuffer(value)) return `E'\\\\x${value.toString('hex')}'`
  if (Array.isArray(value)) return `ARRAY[${value.map(sqlLiteral).join(', ')}]`
  if (typeof value === 'object') return `${quoteString(JSON.stringify(value))}::jsonb`
  return quoteString(value)
}

async function fetchDumpCatalog(client) {
  const { rows: schemas } = await client.query(`
    SELECT nspname
    FROM pg_namespace
    WHERE nspname NOT LIKE 'pg_%' AND nspname <> 'information_schema'
    ORDER BY nspname
  `)
  const { rows: enums } = await client.query(`
    SELECT n.nspname, t.typname, e.enumlabel, e.enumsortorder
    FROM pg_type t
    JOIN pg_enum e ON e.enumtypid = t.oid
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname NOT LIKE 'pg_%' AND n.nspname <> 'information_schema'
    ORDER BY n.nspname, t.typname, e.enumsortorder
  `)
  const { rows: sequences } = await client.query(`
    SELECT schemaname, sequencename, start_value, increment_by, max_value, min_value, cache_size, cycle, last_value
    FROM pg_sequences
    WHERE schemaname NOT LIKE 'pg_%' AND schemaname <> 'information_schema'
    ORDER BY schemaname, sequencename
  `)
  const { rows: tables } = await client.query(`
    SELECT n.nspname, c.relname, c.oid
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relkind = 'r'
      AND n.nspname NOT LIKE 'pg_%' AND n.nspname <> 'information_schema'
    ORDER BY n.nspname, c.relname
  `)
  const { rows: columns } = await client.query(`
    SELECT
      n.nspname,
      c.relname,
      a.attname,
      pg_catalog.format_type(a.atttypid, a.atttypmod) AS typ,
      a.attnotnull,
      a.atthasdef,
      pg_get_expr(d.adbin, d.adrelid) AS def,
      a.attidentity,
      a.attgenerated,
      a.attnum
    FROM pg_attribute a
    JOIN pg_class c ON c.oid = a.attrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    LEFT JOIN pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
    WHERE a.attnum > 0 AND NOT a.attisdropped
      AND c.relkind = 'r'
      AND n.nspname NOT LIKE 'pg_%' AND n.nspname <> 'information_schema'
    ORDER BY n.nspname, c.relname, a.attnum
  `)
  const { rows: constraints } = await client.query(`
    SELECT
      n.nspname,
      c.relname,
      con.conname,
      con.contype,
      pg_get_constraintdef(con.oid) AS def
    FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname NOT LIKE 'pg_%' AND n.nspname <> 'information_schema'
    ORDER BY n.nspname, c.relname, con.contype, con.conname
  `)
  const { rows: indexes } = await client.query(`
    SELECT pg_get_indexdef(i.indexrelid) AS def
    FROM pg_index i
    JOIN pg_class c ON c.oid = i.indrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname NOT LIKE 'pg_%' AND n.nspname <> 'information_schema'
      AND NOT i.indisprimary
      AND NOT EXISTS (
        SELECT 1 FROM pg_constraint con WHERE con.conindid = i.indexrelid
      )
    ORDER BY 1
  `)
  return { schemas, enums, sequences, tables, columns, constraints, indexes }
}

function columnSql(col) {
  let line = `  ${qid(col.attname)} ${col.typ}`
  if (col.attidentity === 'd') line += ' GENERATED BY DEFAULT AS IDENTITY'
  else if (col.attidentity === 'a') line += ' GENERATED ALWAYS AS IDENTITY'
  else if (col.attgenerated === 's' && col.def) line += ` GENERATED ALWAYS AS (${col.def}) STORED`
  else if (col.atthasdef && col.def) line += ` DEFAULT ${col.def}`
  if (col.attnotnull) line += ' NOT NULL'
  return line
}

async function dumpTableRows(client, table, out) {
  const rel = qrel(table.nspname, table.relname)
  const { rows: colRows } = await client.query(`
    SELECT a.attname
    FROM pg_attribute a
    WHERE a.attrelid = $1 AND a.attnum > 0 AND NOT a.attisdropped
    ORDER BY a.attnum
  `, [table.oid])
  const colNames = colRows.map((c) => c.attname)
  if (!colNames.length) return

  const typed = await client.query({
    text: `SELECT ${colNames.map((name) => qid(name)).join(', ')} FROM ${rel}`,
    rowMode: 'array'
  })
  const selectList = typed.fields
    .map((field, i) => TIMESTAMP_OIDS.has(field.dataTypeID) ? `${qid(colNames[i])}::text` : qid(colNames[i]))
    .join(', ')
  const result = selectList === typed.fields.map((_, i) => qid(colNames[i])).join(', ')
    ? typed
    : await client.query({ text: `SELECT ${selectList} FROM ${rel}`, rowMode: 'array' })

  if (!result.rows.length) return
  const colsSql = colNames.map(qid).join(', ')
  for (let i = 0; i < result.rows.length; i += INSERT_BATCH) {
    const batch = result.rows.slice(i, i + INSERT_BATCH)
    const values = batch.map((row) => `  (${row.map(sqlLiteral).join(', ')})`).join(',\n')
    out(`INSERT INTO ${rel} (${colsSql}) VALUES\n${values};\n`)
  }
  out('\n')
}

export async function runJsSqlDump(databaseUrl) {
  parseDatabaseUrl(databaseUrl)
  const pool = new pg.Pool({
    connectionString: databaseUrl,
    connectionTimeoutMillis: 15000
  })
  const client = await pool.connect()
  const parts = []
  const out = (s) => parts.push(s)
  try {
    await client.query("SET intervalstyle = 'postgres'")
    const catalog = await fetchDumpCatalog(client)
    out('-- OCN SQL dump\n')
    out('-- Dibuat dari koneksi aplikasi (tanpa pg_dump)\n')
    out('SET client_encoding = \'UTF8\';\n')
    out('SET standard_conforming_strings = on;\n\n')

    for (const schema of catalog.schemas) {
      if (schema.nspname === 'public') continue
      out(`CREATE SCHEMA IF NOT EXISTS ${qid(schema.nspname)};\n`)
    }
    if (catalog.schemas.some((s) => s.nspname !== 'public')) out('\n')

    for (const table of [...catalog.tables].reverse()) {
      out(`DROP TABLE IF EXISTS ${qrel(table.nspname, table.relname)} CASCADE;\n`)
    }
    for (const seq of catalog.sequences) {
      out(`DROP SEQUENCE IF EXISTS ${qrel(seq.schemaname, seq.sequencename)} CASCADE;\n`)
    }
    const enumNames = [...new Set(catalog.enums.map((e) => `${e.nspname}.${e.typname}`))]
    for (const key of enumNames.reverse()) {
      const [schema, name] = key.split('.')
      out(`DROP TYPE IF EXISTS ${qrel(schema, name)} CASCADE;\n`)
    }
    out('\n')

    const enumsByType = new Map()
    for (const row of catalog.enums) {
      const key = `${row.nspname}.${row.typname}`
      if (!enumsByType.has(key)) enumsByType.set(key, { schema: row.nspname, name: row.typname, labels: [] })
      enumsByType.get(key).labels.push(row.enumlabel)
    }
    for (const type of enumsByType.values()) {
      out(`CREATE TYPE ${qrel(type.schema, type.name)} AS ENUM (${type.labels.map(quoteString).join(', ')});\n`)
    }
    if (enumsByType.size) out('\n')

    for (const seq of catalog.sequences) {
      out(`CREATE SEQUENCE ${qrel(seq.schemaname, seq.sequencename)}\n`)
      out(`  START WITH ${seq.start_value}\n`)
      out(`  INCREMENT BY ${seq.increment_by}\n`)
      out(`  MINVALUE ${seq.min_value}\n`)
      out(`  MAXVALUE ${seq.max_value}\n`)
      out(`  CACHE ${seq.cache_size}${seq.cycle ? '\n  CYCLE' : ''};\n\n`)
    }

    const columnsByTable = new Map()
    for (const col of catalog.columns) {
      const key = `${col.nspname}.${col.relname}`
      if (!columnsByTable.has(key)) columnsByTable.set(key, [])
      columnsByTable.get(key).push(col)
    }
    const constraintsByTable = new Map()
    for (const con of catalog.constraints) {
      const key = `${con.nspname}.${con.relname}`
      if (!constraintsByTable.has(key)) constraintsByTable.set(key, [])
      constraintsByTable.get(key).push(con)
    }

    for (const table of catalog.tables) {
      const key = `${table.nspname}.${table.relname}`
      const cols = (columnsByTable.get(key) || []).map(columnSql)
      const localCons = (constraintsByTable.get(key) || [])
        .filter((c) => c.contype === 'p' || c.contype === 'u' || c.contype === 'c')
        .map((c) => `  CONSTRAINT ${qid(c.conname)} ${c.def}`)
      out(`CREATE TABLE ${qrel(table.nspname, table.relname)} (\n${[...cols, ...localCons].join(',\n')}\n);\n\n`)
    }

    out('SET session_replication_role = replica;\n\n')
    for (const table of catalog.tables) {
      await dumpTableRows(client, table, out)
    }
    out('SET session_replication_role = DEFAULT;\n\n')

    for (const idx of catalog.indexes) {
      if (idx.def) out(`${idx.def};\n`)
    }
    if (catalog.indexes.length) out('\n')

    for (const con of catalog.constraints) {
      if (con.contype !== 'f') continue
      out(`ALTER TABLE ${qrel(con.nspname, con.relname)} ADD CONSTRAINT ${qid(con.conname)} ${con.def};\n`)
    }
    if (catalog.constraints.some((c) => c.contype === 'f')) out('\n')

    for (const seq of catalog.sequences) {
      if (seq.last_value == null) continue
      out(`SELECT pg_catalog.setval(${quoteString(`${seq.schemaname}.${seq.sequencename}`)}, ${seq.last_value}, true);\n`)
    }
    out('\n')
  } finally {
    client.release()
    await pool.end()
  }
  return Buffer.from(parts.join(''), 'utf8')
}

export async function createDatabaseDump(databaseUrl) {
  try {
    return await runJsSqlDump(databaseUrl)
  } catch (e) {
    if (e?.statusCode) throw e
    console.error('[OCN] SQL dump gagal:', e)
    throw createError({ statusCode: 500, statusMessage: 'Gagal membuat dump database' })
  }
}
