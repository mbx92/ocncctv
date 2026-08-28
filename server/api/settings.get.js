import { getSettings, presentSettings } from '../utils/settings.js'

export default defineEventHandler(async () => {
  return presentSettings(await getSettings())
})
