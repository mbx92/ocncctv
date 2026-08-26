DO $$ BEGIN
  CREATE TYPE "public"."sale_payment_status" AS ENUM('unpaid', 'paid');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
ALTER TABLE "sales" ADD COLUMN IF NOT EXISTS "payment_status" "sale_payment_status" DEFAULT 'paid' NOT NULL;--> statement-breakpoint
ALTER TABLE "sales" ADD COLUMN IF NOT EXISTS "payment_method" text;--> statement-breakpoint
ALTER TABLE "sales" ADD COLUMN IF NOT EXISTS "paid_at" date;
