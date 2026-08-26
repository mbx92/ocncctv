ALTER TABLE "sales" ADD COLUMN IF NOT EXISTS "discount_kind" text DEFAULT 'amount' NOT NULL;--> statement-breakpoint
ALTER TABLE "sales" ADD COLUMN IF NOT EXISTS "discount_percent" real DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "sales" ADD COLUMN IF NOT EXISTS "payment_notes" text;
