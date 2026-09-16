import { runCatalogSync } from '../utils/catalogSync.js'

export default defineTask({
  meta: {
    name: 'catalog:sync',
    description: 'Tarik katalog supplier dari Google Sheets'
  },
  async run() {
    const result = await runCatalogSync({ source: 'schedule' })
    return { result }
  }
})
