-- Uang muka proyek. Invoice penjualan mengurangi total dengan snapshot DP.
CREATE TABLE IF NOT EXISTS "project_down_payments" (
	"id" serial PRIMARY KEY NOT NULL,
	"product_id" integer NOT NULL,
	"date" date NOT NULL,
	"amount" integer DEFAULT 0 NOT NULL,
	"method" text DEFAULT 'transfer' NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint
ALTER TABLE "project_down_payments" ADD CONSTRAINT "project_down_payments_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "project_down_payments_product_id_idx" ON "project_down_payments" ("product_id");--> statement-breakpoint
ALTER TABLE "sales" ADD COLUMN IF NOT EXISTS "down_payment_amount" integer DEFAULT 0 NOT NULL;
