ALTER TABLE "materials" ADD COLUMN IF NOT EXISTS "purchase_unit" text;--> statement-breakpoint
ALTER TABLE "materials" ADD COLUMN IF NOT EXISTS "units_per_purchase" integer DEFAULT 1 NOT NULL;
