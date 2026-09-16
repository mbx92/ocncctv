-- Kabel supplier dijual per roll; RAB dan stok gudang memakai meter.
ALTER TABLE "supplier_catalog_items" ADD COLUMN IF NOT EXISTS "content_qty" integer;--> statement-breakpoint
ALTER TABLE "packaging" ADD COLUMN IF NOT EXISTS "purchase_unit" text;--> statement-breakpoint
ALTER TABLE "packaging" ADD COLUMN IF NOT EXISTS "units_per_purchase" integer DEFAULT 1 NOT NULL;
