ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "customer_name" text;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "erp_project_id" text;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "products_erp_project_id_uidx" ON "products" ("erp_project_id") WHERE "erp_project_id" IS NOT NULL;--> statement-breakpoint
ALTER TABLE "app_settings" ADD COLUMN IF NOT EXISTS "erp_sync_base_url" text;--> statement-breakpoint
ALTER TABLE "app_settings" ADD COLUMN IF NOT EXISTS "erp_sync_api_key" text;--> statement-breakpoint
ALTER TABLE "app_settings" ADD COLUMN IF NOT EXISTS "erp_sync_last_at" timestamp;
