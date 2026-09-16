import { eq, desc, inArray } from 'drizzle-orm'
import { useDb, schema } from '../../db/index.js'
import { sanitizeText } from '../../utils/sanitizeText.js'

export default defineEventHandler(async () => {
  const db = useDb()
  const purchases = await db
    .select()
    .from(schema.supplierPurchases)
    .orderBy(desc(schema.supplierPurchases.date), desc(schema.supplierPurchases.id))

  if (!purchases.length) return []

  const lines = await db.select().from(schema.supplierPurchaseLines)
  const materials = await db.select({ id: schema.materials.id, name: schema.materials.name, unit: schema.materials.unit }).from(schema.materials)
  const packaging = await db
    .select({
      id: schema.packaging.id,
      name: schema.packaging.name,
      unit: schema.packaging.unit,
      purchaseUnit: schema.packaging.purchaseUnit,
      unitsPerPurchase: schema.packaging.unitsPerPurchase
    })
    .from(schema.packaging)
  const projects = await db.select({ id: schema.products.id, name: schema.products.name }).from(schema.products)
  const expenseIds = [...new Set(purchases.map((p) => p.expenseId).filter(Boolean))]
  const expenses = expenseIds.length
    ? await db
        .select({ id: schema.expenses.id, category: schema.expenses.category })
        .from(schema.expenses)
        .where(inArray(schema.expenses.id, expenseIds))
    : []
  const matMap = new Map(materials.map((m) => [m.id, m]))
  const packMap = new Map(packaging.map((p) => [p.id, p]))
  const projectMap = new Map(projects.map((p) => [p.id, p]))
  const expenseMap = new Map(expenses.map((e) => [e.id, e]))

  const linesByPurchase = new Map()
  for (const line of lines) {
    const item =
      line.itemType === 'material' ? matMap.get(line.materialId) : packMap.get(line.packagingId)
    const row = {
      ...line,
      itemName: sanitizeText(item?.name) || '(barang dihapus)',
      unit:
        sanitizeText(
          line.itemType === 'packaging' && Number(item?.unitsPerPurchase) > 1
            ? item?.purchaseUnit || 'roll'
            : item?.unit
        ) || '',
      stockUnit: sanitizeText(item?.unit) || '',
      unitsPerPurchase: Number(item?.unitsPerPurchase) || 1
    }
    const arr = linesByPurchase.get(line.purchaseId) || []
    arr.push(row)
    linesByPurchase.set(line.purchaseId, arr)
  }

  return purchases.map((p) => ({
    ...p,
    supplier: sanitizeText(p.supplier) || p.supplier,
    notes: p.notes ? sanitizeText(p.notes) : p.notes,
    projectName: projectMap.get(p.projectId)?.name || null,
    expenseCategory: expenseMap.get(p.expenseId)?.category || null,
    lines: linesByPurchase.get(p.id) || []
  }))
})
