import { spawn } from 'node:child_process'
import { localDateStr } from './dates.js'

const DUMP_TIMEOUT_MS = 120_000

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

function sanitizeDumpError(raw) {
  const text = String(raw || '').replace(/\s+/g, ' ').trim()
  if (!text) return 'pg_dump gagal'
  if (/password authentication failed/i.test(text)) return 'Autentikasi database gagal'
  if (/could not connect|connection refused|timeout/i.test(text)) return 'Tidak bisa terhubung ke database'
  if (/database ".+" does not exist/i.test(text)) return 'Database tidak ditemukan'
  return 'Gagal membuat dump database'
}

export function runPgDump(databaseUrl) {
  const cfg = parseDatabaseUrl(databaseUrl)
  return new Promise((resolve, reject) => {
    const child = spawn('pg_dump', [
      '--no-owner',
      '--no-acl',
      '--format=plain',
      '--encoding=UTF8',
      '-h', cfg.host,
      '-p', String(cfg.port),
      '-U', cfg.user,
      '-d', cfg.database
    ], {
      env: { ...process.env, PGPASSWORD: cfg.password, PGSSLMODE: cfg.sslmode },
      stdio: ['ignore', 'pipe', 'pipe']
    })

    const chunks = []
    const errors = []
    let settled = false

    const finish = (err, data) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      if (err) reject(err)
      else resolve(data)
    }

    const timer = setTimeout(() => {
      child.kill('SIGKILL')
      finish(createError({ statusCode: 504, statusMessage: 'Backup database timeout' }))
    }, DUMP_TIMEOUT_MS)

    child.stdout.on('data', (d) => chunks.push(d))
    child.stderr.on('data', (d) => errors.push(d))
    child.on('error', (err) => {
      if (err.code === 'ENOENT') {
        finish(createError({
          statusCode: 500,
          statusMessage: 'pg_dump tidak ditemukan di server. Instal PostgreSQL client.'
        }))
        return
      }
      finish(createError({ statusCode: 500, statusMessage: 'Gagal menjalankan pg_dump' }))
    })
    child.on('close', (code) => {
      if (code !== 0) {
        const stderr = Buffer.concat(errors).toString('utf8')
        console.error('[OCN] pg_dump gagal:', sanitizeDumpError(stderr))
        finish(createError({ statusCode: 500, statusMessage: sanitizeDumpError(stderr) }))
        return
      }
      finish(null, Buffer.concat(chunks))
    })
  })
}
