ALTER TABLE "app_settings" ADD COLUMN IF NOT EXISTS "catalog_sync_last_at" timestamp;--> statement-breakpoint
ALTER TABLE "app_settings" ADD COLUMN IF NOT EXISTS "catalog_sync_last_source" text;--> statement-breakpoint
ALTER TABLE "app_settings" ADD COLUMN IF NOT EXISTS "catalog_sync_last_message" text;--> statement-breakpoint
ALTER TABLE "app_settings" ADD COLUMN IF NOT EXISTS "catalog_sync_created" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "app_settings" ADD COLUMN IF NOT EXISTS "catalog_sync_updated" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "app_settings" ADD COLUMN IF NOT EXISTS "catalog_sync_removed" integer DEFAULT 0 NOT NULL;
