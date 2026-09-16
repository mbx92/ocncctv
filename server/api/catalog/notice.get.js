import { getCatalogSyncNotice } from '../../utils/catalogSync.js'

export default defineEventHandler(async () => getCatalogSyncNotice())
