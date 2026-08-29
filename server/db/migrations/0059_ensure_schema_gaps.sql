-- Pemulihan kolom/tipe yang mungkin terlewat karena migrasi 0052–0054 tidak tercatat di journal
-- pada deploy sebelumnya (migrate.js lama melewati entri dengan timestamp lebih kecil dari migrasi terakhir).
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "customer_name" text;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "erp_project_id" text;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "erp_total_value" integer;--> statement-breakpoint
ALTER TYPE "public"."custom_order_line_type" ADD VALUE IF NOT EXISTS 'product';--> statement-breakpoint
ALTER TABLE "custom_order_lines" ADD COLUMN IF NOT EXISTS "packaging_id" integer;--> statement-breakpoint
ALTER TYPE "public"."product_status" ADD VALUE IF NOT EXISTS 'pending';
