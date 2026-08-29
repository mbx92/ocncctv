import { useDb, schema } from '../../../db/index.js'
import { buildRabPurchaseDraft } from '../../../utils/rabPurchase.js'

export default defineEventHandler(async (event) => {
  const productId = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(productId) || productId <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'ID proyek tidak valid' })
  }
  const db = useDb()
  return buildRabPurchaseDraft(db, schema, productId)
})
