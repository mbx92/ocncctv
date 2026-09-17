import { ensureVapidKeys } from '../../utils/push.js'

export default defineEventHandler(async () => {
  const keys = await ensureVapidKeys()
  return { publicKey: keys.publicKey }
})
