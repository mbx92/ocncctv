import { eq } from 'drizzle-orm'
import { useDb, schema } from '../../db/index.js'
import { requireAdmin } from '../../utils/rbac.js'
import { logAudit } from '../../utils/audit.js'
import { renameModelFilename } from '../../utils/modelFilename.js'

export default defineEventHandler(async (event) => {
  requireAdmin(event)
  const id = Number(getRouterParam(event, 'id'))
  const body = (await readBody(event).catch(() => null)) || {}
  const db = useDb()
  const [row] = await db.select().from(schema.libraryFiles).where(eq(schema.libraryFiles.id, id))
  if (!row) throw createError({ statusCode: 404, statusMessage: 'File tidak ditemukan' })

  const filename = renameModelFilename(body.filename, row.filename)
  if (filename === row.filename) return row

  const [updated] = await db
    .update(schema.libraryFiles)
    .set({ filename })
    .where(eq(schema.libraryFiles.id, id))
    .returning()
  await logAudit(event, {
    action: 'update',
    entity: 'library_file',
    entityId: id,
    summary: `Rename file 3D galeri "${row.filename}" → "${filename}"`
  })
  return updated
})
