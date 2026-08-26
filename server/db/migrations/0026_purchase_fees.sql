ALTER TABLE "supplier_purchases" ADD COLUMN IF NOT EXISTS "shipping_fee" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "supplier_purchases" ADD COLUMN IF NOT EXISTS "platform_fee" integer DEFAULT 0 NOT NULL;
