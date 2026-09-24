import { eq, sql } from 'drizzle-orm'
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
  const id = Number(getRouterParam(event, 'id'))
  const body = await readBody(event)
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
    .update(schema.materials)
    .set({
      name: body.name,
      type: parseMaterialType(body.type, 'consumable'),
      unit: converted.unit,
      purchaseUnit: converted.purchaseUnit,
      unitsPerPurchase: converted.unitsPerPurchase,
      pricePerUnit: converted.pricePerUnit,
      stockQuantity: converted.stockQuantity,
      lowStockQuantity,
      stockStatus: stockStatusFromQuantity(converted.stockQuantity, lowStockQuantity),
      supplier: body.supplier || null
    })
    .where(eq(schema.materials.id, id))
    .returning()
  if (!rows.length) throw createError({ statusCode: 404, statusMessage: 'Perlengkapan tidak ditemukan' })
  const price = Math.max(Math.round(Number(rows[0].pricePerUnit) || 0), 0)
  await db
    .update(schema.materialUsages)
    .set({
      unitPrice: price,
      amount: sql`${schema.materialUsages.quantity} * ${price}`
    })
    .where(eq(schema.materialUsages.materialId, id))
  await logAudit(event, { action: 'update', entity: 'material', entityId: id, summary: `Ubah perlengkapan "${rows[0].name}"` })
  return rows[0]
})
