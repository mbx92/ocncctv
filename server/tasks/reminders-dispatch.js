import { dispatchPushReminders } from '../utils/reminders.js'

export default defineTask({
  meta: {
    name: 'reminders:dispatch',
    description: 'Kirim push pengingat kalender dan tagihan jatuh tempo'
  },
  async run() {
    const result = await dispatchPushReminders()
    return { result }
  }
})
