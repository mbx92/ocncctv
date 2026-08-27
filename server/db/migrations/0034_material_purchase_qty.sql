-- Ambang stok menipis + label kategori pengeluaran pembelian perlengkapan.
ALTER TABLE "materials" ADD COLUMN IF NOT EXISTS "low_stock_quantity" real DEFAULT 2 NOT NULL;--> statement-breakpoint
UPDATE "expense_categories" SET "name" = 'Perlengkapan' WHERE "key" = 'material';
