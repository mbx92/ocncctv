import {
  pgTable,
  pgEnum,
  serial,
  text,
  integer,
  real,
  date,
  timestamp,
  uniqueIndex,
  index as pgIndex,
  boolean
} from 'drizzle-orm/pg-core'

export const userRoleEnum = pgEnum('user_role', ['admin', 'staff'])
export const materialTypeEnum = pgEnum('material_type', ['filament', 'resin', 'part', 'consumable'])
export const productStatusEnum = pgEnum('product_status', [
  'draft',
  'rnd',
  'active',
  'discontinued',
  'waiting',
  'in_progress',
  'done'
])
export const salesChannelEnum = pgEnum('sales_channel', [
  'tokopedia',
  'shopee',
  'tiktok_shop',
  'instagram',
  'whatsapp',
  'direct',
  'other'
])
export const salePaymentStatusEnum = pgEnum('sale_payment_status', ['unpaid', 'paid'])
export const capitalTypeEnum = pgEnum('capital_type', ['deposit', 'withdrawal'])
export const productionStatusEnum = pgEnum('production_status', [
  'queued',
  'in_progress',
  'done',
  'cancelled'
])
export const customOrderStatusEnum = pgEnum('custom_order_status', [
  'draft',
  'sent',
  'deal',
  'lost',
  'open',
  'ready',
  'delivered',
  'cancelled'
])
export const customOrderLineTypeEnum = pgEnum('custom_order_line_type', [
  'catalog',
  'service',
  'product'
])

// Master jasa RAB. Tidak ada stok. Nama & harga jual disalin ke baris penawaran.
export const services = pgTable('services', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  unit: text('unit').notNull().default('titik'),
  salePrice: integer('sale_price').notNull().default(0),
  notes: text('notes'),
  createdAt: timestamp('created_at').notNull().defaultNow()
})

export const suppliers = pgTable('suppliers', {
  id: serial('id').primaryKey(),
  name: text('name').notNull().unique(),
  notes: text('notes'),
  createdAt: timestamp('created_at').notNull().defaultNow()
})

// Daftar teknisi (seperti supplier): pilih dari dropdown, kelola tanpa menu sendiri.
export const technicians = pgTable('technicians', {
  id: serial('id').primaryKey(),
  name: text('name').notNull().unique(),
  notes: text('notes'),
  createdAt: timestamp('created_at').notNull().defaultNow()
})

// Daftar harga distributor (satu baris = satu SKU di tab Google Sheet).
// Harga disimpan integer rupiah. Dipakai halaman Katalog; nanti juga picker RAB.
export const supplierCatalogItems = pgTable(
  'supplier_catalog_items',
  {
    id: serial('id').primaryKey(),
    ref: text('ref').notNull(),
    sheetKey: text('sheet_key').notNull(),
    sheetLabel: text('sheet_label').notNull(),
    supplierName: text('supplier_name').notNull(),
    code: text('code').notNull(),
    name: text('name').notNull(),
    category: text('category'),
    unit: text('unit').notNull().default('pcs'),
    supplierPrice: integer('supplier_price').notNull().default(0),
    lastPrice: integer('last_price'),
    lastSyncedAt: timestamp('last_synced_at'),
    createdAt: timestamp('created_at').notNull().defaultNow()
  },
  (t) => ({
    refUniq: uniqueIndex('supplier_catalog_items_ref_uidx').on(t.ref),
    sheetKeyIdx: pgIndex('supplier_catalog_items_sheet_key_idx').on(t.sheetKey),
    sheetCodeIdx: pgIndex('supplier_catalog_items_sheet_code_idx').on(t.sheetKey, t.code)
  })
)

// Series produk 3D: pengelompokan opsional di halaman Produk.
// Satu produk hanya bisa masuk satu series (series_id).
export const productSeries = pgTable('product_series', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  // Object key gambar sampul series di MinIO. null = tanpa sampul.
  imageKey: text('image_key'),
  createdAt: timestamp('created_at').notNull().defaultNow()
})

// Pengguna sistem. Admin: akses penuh. Staff: hanya boleh mencatat
// Pengeluaran, Penjualan & Produksi, sisanya (Material/Mesin/Packaging/Produk/
// Pengaturan/User) read-only — ditegakkan di server/utils/rbac.js.
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  username: text('username').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  role: userRoleEnum('role').notNull().default('staff'),
  createdAt: timestamp('created_at').notNull().defaultNow()
})

// Semua nilai uang disimpan sebagai integer rupiah (tanpa desimal).
export const materials = pgTable('materials', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  type: materialTypeEnum('type').notNull().default('consumable'),
  unit: text('unit').notNull().default('pcs'),
  pricePerUnit: integer('price_per_unit').notNull().default(0),
  stockQuantity: real('stock_quantity').notNull().default(0),
  // ok = ada, low = menipis, empty = habis. Dihitung dari stockQuantity vs lowStockQuantity.
  stockStatus: text('stock_status').notNull().default('ok'),
  lowStockQuantity: real('low_stock_quantity').notNull().default(2),
  supplier: text('supplier'),
  // Object key gambar di MinIO (bucket sama dengan file 3D). null = tanpa gambar.
  imageKey: text('image_key'),
  createdAt: timestamp('created_at').notNull().defaultNow()
})

export const machines = pgTable('machines', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  powerWatt: integer('power_watt').notNull().default(0),
  purchasePrice: integer('purchase_price').notNull().default(0),
  purchaseDate: date('purchase_date'),
  depreciationMonths: integer('depreciation_months').notNull().default(36),
  notes: text('notes'),
  // Pengeluaran otomatis dari harga beli. Kas keluar sekali di sini, bukan dipotong lagi di modal.
  expenseId: integer('expense_id').references(() => expenses.id, { onDelete: 'set null' }),
  // Object key gambar di MinIO (bucket sama dengan file 3D). null = tanpa gambar.
  imageKey: text('image_key'),
  // owned = sudah dimiliki (aset/modal, tanpa pengeluaran).
  // purchased = beli baru (kas keluar, tercatat di pengeluaran).
  acquisition: text('acquisition').notNull().default('owned')
})

export const products = pgTable('products', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  status: productStatusEnum('status').notNull().default('waiting'),
  // Object key gambar di MinIO — dipakai sebagai foto utama di katalog.
  imageKey: text('image_key'),
  // Series tempat produk ini bernaung (boleh null = belum punya series).
  seriesId: integer('series_id').references(() => productSeries.id, {
    onDelete: 'set null'
  }),
  // Stok barang jadi. Bertambah saat produksi selesai, berkurang saat penjualan.
  stockQuantity: integer('stock_quantity').notNull().default(0),
  plannedStartDate: date('planned_start_date'),
  startedAt: date('started_at'),
  completedAt: date('completed_at'),
  customerName: text('customer_name'),
  erpProjectId: text('erp_project_id'),
  createdAt: timestamp('created_at').notNull().defaultNow()
}, (t) => ({
  erpProjectUniq: uniqueIndex('products_erp_project_id_uidx').on(t.erpProjectId)
}))

export const productImages = pgTable('product_images', {
  id: serial('id').primaryKey(),
  productId: integer('product_id')
    .notNull()
    .references(() => products.id, { onDelete: 'cascade' }),
  objectKey: text('object_key').notNull(),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: timestamp('created_at').notNull().defaultNow()
})

export const expenseCategories = pgTable('expense_categories', {
  id: serial('id').primaryKey(),
  key: text('key').notNull().unique(),
  name: text('name').notNull(),
  isSystem: boolean('is_system').notNull().default(false),
  sortOrder: integer('sort_order').notNull().default(100),
  createdAt: timestamp('created_at').notNull().defaultNow()
})

export const expenses = pgTable('expenses', {
  id: serial('id').primaryKey(),
  date: date('date').notNull(),
  category: text('category')
    .notNull()
    .default('other')
    .references(() => expenseCategories.key),
  description: text('description').notNull(),
  amount: integer('amount').notNull().default(0),
  relatedProductId: integer('related_product_id').references(() => products.id, {
    onDelete: 'set null'
  }),
  technicianId: integer('technician_id').references(() => technicians.id, {
    onDelete: 'set null'
  }),
  createdAt: timestamp('created_at').notNull().defaultNow()
})

// Satu pengeluaran bisa terkait banyak produk (mis. beli PLA yang dipakai
// beberapa recipe). related_product_id tetap diisi produk pertama agar
// filter lama tetap jalan.
export const expenseProducts = pgTable(
  'expense_products',
  {
    id: serial('id').primaryKey(),
    expenseId: integer('expense_id')
      .notNull()
      .references(() => expenses.id, { onDelete: 'cascade' }),
    productId: integer('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' })
  },
  (t) => ({
    expenseProductUniq: uniqueIndex('expense_products_expense_id_product_id_idx').on(t.expenseId, t.productId)
  })
)

export const productRecipes = pgTable('product_recipes', {
  id: serial('id').primaryKey(),
  productId: integer('product_id')
    .notNull()
    .references(() => products.id, { onDelete: 'cascade' }),
  materialId: integer('material_id')
    .notNull()
    .references(() => materials.id),
  quantityUsed: real('quantity_used').notNull().default(0),
  printTimeMinutes: integer('print_time_minutes').notNull().default(0),
  machineId: integer('machine_id').references(() => machines.id),
  failureRatePercent: real('failure_rate_percent').notNull().default(5),
  laborMinutes: integer('labor_minutes').notNull().default(0),
  laborRatePerHour: integer('labor_rate_per_hour').notNull().default(0)
})

export const packaging = pgTable('packaging', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  unit: text('unit').notNull().default('pcs'),
  pricePerUnit: integer('price_per_unit').notNull().default(0),
  stockQuantity: real('stock_quantity').notNull().default(0),
  supplier: text('supplier'),
  // Object key gambar di MinIO (bucket sama dengan file 3D). null = tanpa gambar.
  imageKey: text('image_key'),
  createdAt: timestamp('created_at').notNull().defaultNow()
})

export const productPackaging = pgTable('product_packaging', {
  id: serial('id').primaryKey(),
  productId: integer('product_id')
    .notNull()
    .references(() => products.id, { onDelete: 'cascade' }),
  packagingId: integer('packaging_id')
    .notNull()
    .references(() => packaging.id),
  quantityUsed: real('quantity_used').notNull().default(1)
})

// Pembagian upah teknisi per proyek. Mengurangi laba di tab Revenue; tidak otomatis jadi pengeluaran kas.
export const projectTechnicianWages = pgTable(
  'project_technician_wages',
  {
    id: serial('id').primaryKey(),
    productId: integer('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    technicianId: integer('technician_id').references(() => technicians.id, {
      onDelete: 'set null'
    }),
    name: text('name').notNull(),
    amount: integer('amount').notNull().default(0),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: timestamp('created_at').notNull().defaultNow()
  },
  (t) => ({
    productIdx: pgIndex('project_technician_wages_product_id_idx').on(t.productId),
    technicianIdx: pgIndex('project_technician_wages_technician_id_idx').on(t.technicianId)
  })
)

// Item/jasa tambahan di proyek, di luar baris RAB. Penawaran RAB tetap utuh.
export const projectExtraLines = pgTable(
  'project_extra_lines',
  {
    id: serial('id').primaryKey(),
    productId: integer('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    lineType: customOrderLineTypeEnum('line_type').notNull().default('catalog'),
    catalogItemId: integer('catalog_item_id').references(() => supplierCatalogItems.id, {
      onDelete: 'set null'
    }),
    serviceId: integer('service_id').references(() => services.id, { onDelete: 'set null' }),
    packagingId: integer('packaging_id').references(() => packaging.id, { onDelete: 'set null' }),
    name: text('name').notNull(),
    code: text('code'),
    unit: text('unit'),
    quantity: real('quantity').notNull().default(1),
    costPrice: integer('cost_price').notNull().default(0),
    salePrice: integer('sale_price').notNull().default(0),
    sortOrder: integer('sort_order').notNull().default(0)
  },
  (t) => ({
    productIdx: pgIndex('project_extra_lines_product_id_idx').on(t.productId)
  })
)

export const customOrders = pgTable(
  'custom_orders',
  {
    id: serial('id').primaryKey(),
    date: date('date').notNull(),
    customerName: text('customer_name').notNull(),
    title: text('title').notNull(),
    channel: salesChannelEnum('channel').notNull().default('direct'),
    quantity: integer('quantity').notNull().default(1),
    pricePerUnit: integer('price_per_unit').notNull().default(0),
    materialId: integer('material_id').references(() => materials.id),
    materialQuantityUsed: real('material_quantity_used').notNull().default(0),
    packagingId: integer('packaging_id').references(() => packaging.id, { onDelete: 'set null' }),
    packagingQuantityUsed: real('packaging_quantity_used').notNull().default(0),
    machineId: integer('machine_id').references(() => machines.id, { onDelete: 'set null' }),
    printTimeMinutes: integer('print_time_minutes').notNull().default(0),
    notes: text('notes'),
    status: customOrderStatusEnum('status').notNull().default('draft'),
    projectId: integer('project_id').references(() => products.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at').notNull().defaultNow()
  },
  (t) => ({
    projectUniq: uniqueIndex('custom_orders_project_id_uidx').on(t.projectId)
  })
)

export const customOrderLines = pgTable(
  'custom_order_lines',
  {
    id: serial('id').primaryKey(),
    customOrderId: integer('custom_order_id')
      .notNull()
      .references(() => customOrders.id, { onDelete: 'cascade' }),
    lineType: customOrderLineTypeEnum('line_type').notNull().default('catalog'),
    catalogItemId: integer('catalog_item_id').references(() => supplierCatalogItems.id, {
      onDelete: 'set null'
    }),
    serviceId: integer('service_id').references(() => services.id, { onDelete: 'set null' }),
    packagingId: integer('packaging_id').references(() => packaging.id, { onDelete: 'set null' }),
    name: text('name').notNull(),
    code: text('code'),
    unit: text('unit'),
    quantity: real('quantity').notNull().default(1),
    costPrice: integer('cost_price').notNull().default(0),
    salePrice: integer('sale_price').notNull().default(0),
    sortOrder: integer('sort_order').notNull().default(0)
  },
  (t) => ({
    orderIdx: pgIndex('custom_order_lines_custom_order_id_idx').on(t.customOrderId),
    packagingIdx: pgIndex('custom_order_lines_packaging_id_idx').on(t.packagingId)
  })
)

// Qty aktual baris RAB di proyek (boleh lebih kecil / 0). Penawaran RAB tidak diubah.
export const projectRabAdjustments = pgTable(
  'project_rab_adjustments',
  {
    id: serial('id').primaryKey(),
    productId: integer('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    customOrderLineId: integer('custom_order_line_id')
      .notNull()
      .references(() => customOrderLines.id, { onDelete: 'cascade' }),
    quantity: real('quantity').notNull().default(0)
  },
  (t) => ({
    productLineUniq: uniqueIndex('project_rab_adjustments_product_line_uidx').on(
      t.productId,
      t.customOrderLineId
    )
  })
)

export const customOrderFiles = pgTable('custom_order_files', {
  id: serial('id').primaryKey(),
  customOrderId: integer('custom_order_id')
    .notNull()
    .references(() => customOrders.id, { onDelete: 'cascade' }),
  filename: text('filename').notNull(),
  objectKey: text('object_key').notNull(),
  sizeBytes: integer('size_bytes').notNull().default(0),
  contentType: text('content_type'),
  createdAt: timestamp('created_at').notNull().defaultNow()
})

export const sales = pgTable(
  'sales',
  {
    id: serial('id').primaryKey(),
    date: date('date').notNull(),
    productId: integer('product_id').references(() => products.id),
    customOrderId: integer('custom_order_id').references(() => customOrders.id, { onDelete: 'set null' }),
    quantity: integer('quantity').notNull().default(1),
    salePricePerUnit: integer('sale_price_per_unit').notNull().default(0),
    channel: salesChannelEnum('channel').notNull().default('direct'),
    marketplaceFeePercent: real('marketplace_fee_percent'),
    notes: text('notes'),
    invoiceNumber: text('invoice_number'),
    customerName: text('customer_name'),
    paymentStatus: salePaymentStatusEnum('payment_status').notNull().default('paid'),
    paymentMethod: text('payment_method'),
    paidAt: date('paid_at'),
    discountAmount: integer('discount_amount').notNull().default(0),
    discountKind: text('discount_kind').notNull().default('amount'),
    discountPercent: real('discount_percent').notNull().default(0),
    paymentNotes: text('payment_notes'),
    createdAt: timestamp('created_at').notNull().defaultNow()
  },
  (t) => ({
    customOrderSaleUniq: uniqueIndex('sales_custom_order_id_uidx').on(t.customOrderId),
    invoiceNumberUniq: uniqueIndex('sales_invoice_number_uidx').on(t.invoiceNumber)
  })
)

// File 3D milik produk (STL/OBJ/3MF/GLB). Isi file disimpan di MinIO,
// tabel ini hanya menyimpan metadata + object key di bucket.
export const productFiles = pgTable('product_files', {
  id: serial('id').primaryKey(),
  productId: integer('product_id')
    .notNull()
    .references(() => products.id, { onDelete: 'cascade' }),
  filename: text('filename').notNull(),
  objectKey: text('object_key').notNull(),
  sizeBytes: integer('size_bytes').notNull().default(0),
  contentType: text('content_type'),
  createdAt: timestamp('created_at').notNull().defaultNow()
})

// File 3D lepas (bukan milik produk). Sama seperti product_files: isi di MinIO.
export const libraryFiles = pgTable('library_files', {
  id: serial('id').primaryKey(),
  filename: text('filename').notNull(),
  objectKey: text('object_key').notNull(),
  sizeBytes: integer('size_bytes').notNull().default(0),
  contentType: text('content_type'),
  createdAt: timestamp('created_at').notNull().defaultNow()
})

// Jejak audit untuk aksi mutasi (siapa mengubah apa). username didenormalisasi
// agar tetap terbaca meski user penulisnya kemudian dihapus.
export const auditLogs = pgTable('audit_logs', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id, { onDelete: 'set null' }),
  username: text('username').notNull(),
  action: text('action').notNull(), // create | update | delete
  entity: text('entity').notNull(), // material | machine | packaging | product | product_recipe | product_file | settings | user | expense | sale
  entityId: integer('entity_id'),
  summary: text('summary').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow()
})

// Pengaturan global satu baris: tarif listrik & asumsi jam pakai mesin per bulan
// (dibutuhkan untuk komponen listrik dan depresiasi per jam pada HPP).
export const appSettings = pgTable('app_settings', {
  id: serial('id').primaryKey(),
  electricityRatePerKwh: integer('electricity_rate_per_kwh').notNull().default(1445),
  machineUsageHoursPerMonth: integer('machine_usage_hours_per_month').notNull().default(100),
  defaultMarginPercent: real('default_margin_percent').notNull().default(40),
  salePriceRounding: integer('sale_price_rounding').notNull().default(500),
  invoiceBusinessName: text('invoice_business_name').notNull().default('OCN'),
  invoiceAddress: text('invoice_address'),
  invoicePhone: text('invoice_phone'),
  invoiceFooter: text('invoice_footer'),
  rabFooter: text('rab_footer'),
  invoiceShareTtlDays: integer('invoice_share_ttl_days').notNull().default(7),
  erpSyncBaseUrl: text('erp_sync_base_url'),
  erpSyncApiKey: text('erp_sync_api_key'),
  erpSyncLastAt: timestamp('erp_sync_last_at')
})

// Tautan publik invoice: token acak, kadaluarsa sesuai pengaturan saat dibuat.
export const invoiceShareLinks = pgTable(
  'invoice_share_links',
  {
    id: serial('id').primaryKey(),
    saleId: integer('sale_id')
      .notNull()
      .references(() => sales.id, { onDelete: 'cascade' }),
    token: text('token').notNull(),
    expiresAt: timestamp('expires_at').notNull(),
    createdAt: timestamp('created_at').notNull().defaultNow()
  },
  (t) => ({
    tokenUniq: uniqueIndex('invoice_share_links_token_uidx').on(t.token)
  })
)

// Tautan publik penawaran RAB. Umur tautan memakai invoice_share_ttl_days.
export const rabShareLinks = pgTable(
  'rab_share_links',
  {
    id: serial('id').primaryKey(),
    customOrderId: integer('custom_order_id')
      .notNull()
      .references(() => customOrders.id, { onDelete: 'cascade' }),
    token: text('token').notNull(),
    expiresAt: timestamp('expires_at').notNull(),
    createdAt: timestamp('created_at').notNull().defaultNow()
  },
  (t) => ({
    tokenUniq: uniqueIndex('rab_share_links_token_uidx').on(t.token),
    orderIdx: pgIndex('rab_share_links_custom_order_id_idx').on(t.customOrderId)
  })
)

// Paket siap-share: campuran katalog, produk stok, dan jasa. Harga di-sync dari sumber.
export const packages = pgTable('packages', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  notes: text('notes'),
  createdAt: timestamp('created_at').notNull().defaultNow()
})

export const packageLines = pgTable(
  'package_lines',
  {
    id: serial('id').primaryKey(),
    packageId: integer('package_id')
      .notNull()
      .references(() => packages.id, { onDelete: 'cascade' }),
    lineType: customOrderLineTypeEnum('line_type').notNull().default('catalog'),
    catalogItemId: integer('catalog_item_id').references(() => supplierCatalogItems.id, {
      onDelete: 'set null'
    }),
    serviceId: integer('service_id').references(() => services.id, { onDelete: 'set null' }),
    packagingId: integer('packaging_id').references(() => packaging.id, { onDelete: 'set null' }),
    name: text('name').notNull(),
    code: text('code'),
    unit: text('unit'),
    quantity: real('quantity').notNull().default(1),
    costPrice: integer('cost_price').notNull().default(0),
    salePrice: integer('sale_price').notNull().default(0),
    sortOrder: integer('sort_order').notNull().default(0)
  },
  (t) => ({
    packageIdx: pgIndex('package_lines_package_id_idx').on(t.packageId)
  })
)

export const packageShareLinks = pgTable(
  'package_share_links',
  {
    id: serial('id').primaryKey(),
    packageId: integer('package_id')
      .notNull()
      .references(() => packages.id, { onDelete: 'cascade' }),
    token: text('token').notNull(),
    expiresAt: timestamp('expires_at').notNull(),
    createdAt: timestamp('created_at').notNull().defaultNow()
  },
  (t) => ({
    tokenUniq: uniqueIndex('package_share_links_token_uidx').on(t.token),
    packageIdx: pgIndex('package_share_links_package_id_idx').on(t.packageId)
  })
)

// Mutasi modal awal usaha: setoran (deposit) & penarikan (withdrawal).
// Posisi modal = total setoran − total penarikan. Ekuitas pemilik, bukan laba rugi;
// tidak dicampur dengan beli mesin.
export const capitalTransactions = pgTable('capital_transactions', {
  id: serial('id').primaryKey(),
  date: date('date').notNull(),
  type: capitalTypeEnum('type').notNull().default('deposit'),
  amount: integer('amount').notNull().default(0),
  notes: text('notes'),
  createdAt: timestamp('created_at').notNull().defaultNow()
})

export const purchaseItemTypeEnum = pgEnum('purchase_item_type', ['material', 'packaging'])

// Pembelian ke supplier: satu dokumen = beberapa baris barang.
// Qty beli selalu jadi pengeluaran. Hanya stockQuantity yang masuk gudang
// (Produk / Perlengkapan). Sisa qty = langsung dipakai proyek, tidak stok.
export const supplierPurchases = pgTable('supplier_purchases', {
  id: serial('id').primaryKey(),
  date: date('date').notNull(),
  supplier: text('supplier').notNull(),
  notes: text('notes'),
  totalAmount: integer('total_amount').notNull().default(0),
  shippingFee: integer('shipping_fee').notNull().default(0),
  platformFee: integer('platform_fee').notNull().default(0),
  expenseId: integer('expense_id').references(() => expenses.id, { onDelete: 'set null' }),
  projectId: integer('project_id').references(() => products.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at').notNull().defaultNow()
})

// Batch produksi: pantau proses cetak. Saat status done, stok produk bertambah
// dan stok material/packaging terpotong sesuai recipe (gagal cetak tetap makan material).
export const productions = pgTable(
  'productions',
  {
  id: serial('id').primaryKey(),
  date: date('date').notNull(),
  productId: integer('product_id').references(() => products.id),
  customOrderId: integer('custom_order_id').references(() => customOrders.id, { onDelete: 'cascade' }),
  machineId: integer('machine_id').references(() => machines.id, { onDelete: 'set null' }),
  quantityPlanned: integer('quantity_planned').notNull().default(1),
  quantityGood: integer('quantity_good').notNull().default(0),
  quantityFailed: integer('quantity_failed').notNull().default(0),
  status: productionStatusEnum('status').notNull().default('queued'),
  notes: text('notes'),
  stockApplied: boolean('stock_applied').notNull().default(false),
  startedAt: timestamp('started_at'),
  durationMinutes: integer('duration_minutes').notNull().default(0),
  retryOfId: integer('retry_of_id'),
  createdAt: timestamp('created_at').notNull().defaultNow()
},
  (t) => ({
    retryOfUniq: uniqueIndex('productions_retry_of_id_uidx').on(t.retryOfId)
  })
)

export const supplierPurchaseLines = pgTable('supplier_purchase_lines', {
  id: serial('id').primaryKey(),
  purchaseId: integer('purchase_id')
    .notNull()
    .references(() => supplierPurchases.id, { onDelete: 'cascade' }),
  itemType: purchaseItemTypeEnum('item_type').notNull(),
  materialId: integer('material_id').references(() => materials.id),
  packagingId: integer('packaging_id').references(() => packaging.id),
  quantity: real('quantity').notNull().default(0),
  stockQuantity: real('stock_quantity').notNull().default(0),
  unitPrice: integer('unit_price').notNull().default(0),
  amount: integer('amount').notNull().default(0)
})
