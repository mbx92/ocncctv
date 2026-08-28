ALTER TABLE "supplier_catalog_items" ADD COLUMN IF NOT EXISTS "unit" text DEFAULT 'pcs' NOT NULL;--> statement-breakpoint
UPDATE "custom_order_lines" SET "unit" = 'pcs' WHERE "line_type" = 'catalog' AND ("unit" IS NULL OR trim("unit") = '');--> statement-breakpoint
UPDATE "package_lines" SET "unit" = 'pcs' WHERE "line_type" = 'catalog' AND ("unit" IS NULL OR trim("unit") = '');
