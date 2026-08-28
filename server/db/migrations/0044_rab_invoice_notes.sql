ALTER TABLE "app_settings" ADD COLUMN IF NOT EXISTS "rab_footer" text;--> statement-breakpoint
UPDATE "app_settings" SET "rab_footer" = "invoice_footer" WHERE "rab_footer" IS NULL AND "invoice_footer" IS NOT NULL;
