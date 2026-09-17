import { loadReminderItems } from '../utils/reminders.js'

export default defineEventHandler(async () => {
  return loadReminderItems()
})
