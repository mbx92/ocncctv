import { useDb, schema } from '../../db/index.js'
import { requireAdmin } from '../../utils/rbac.js'
import { logAudit } from '../../utils/audit.js'
import {
  parseMaterialType,
  parseLowStockQuantity,
  parseMaterialStockQuantity,
  parseUnitsPerPurchase,
  parsePurchaseUnit,
  stockStatusFromQuantity
} from '../../utils/materialType.js'
import { normalizeMaterialConversion } from '../../utils/cableRoll.js'

export default defineEventHandler(async (event) => {
  requireAdmin(event)
  const body = await readBody(event)
  if (!body.name) throw createError({ statusCode: 400, statusMessage: 'Nama wajib diisi' })
  const unitsPerPurchase = parseUnitsPerPurchase(body.unitsPerPurchase)
  const converted = normalizeMaterialConversion({
    unit: body.unit || 'pcs',
    purchaseUnit: parsePurchaseUnit(body.purchaseUnit, unitsPerPurchase),
    unitsPerPurchase,
    stockQuantity: parseMaterialStockQuantity(body.stockQuantity),
    pricePerUnit: Math.round(Number(body.pricePerUnit) || 0)
  })
  const lowStockQuantity = parseLowStockQuantity(body.lowStockQuantity)
  const db = useDb()
  const rows = await db
    .insert(schema.materials)
    .values({
      name: body.name,
      type: parseMaterialType(body.type),
      unit: converted.unit,
      purchaseUnit: converted.purchaseUnit,
      unitsPerPurchase: converted.unitsPerPurchase,
      pricePerUnit: converted.pricePerUnit,
      stockQuantity: converted.stockQuantity,
      lowStockQuantity,
      stockStatus: stockStatusFromQuantity(converted.stockQuantity, lowStockQuantity),
      supplier: body.supplier || null
    })
    .returning()
  await logAudit(event, { action: 'create', entity: 'material', entityId: rows[0].id, summary: `Tambah perlengkapan "${rows[0].name}"` })
  return rows[0]
})
