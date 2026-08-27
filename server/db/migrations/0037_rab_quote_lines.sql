-- RAB sebagai penawaran: baris katalog/jasa, tautan ke proyek saat Deal.
ALTER TABLE "custom_orders" ALTER COLUMN "material_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "custom_orders" ALTER COLUMN "status" SET DEFAULT 'draft';--> statement-breakpoint
UPDATE "custom_orders" SET "status" = 'draft' WHERE "status" = 'open';--> statement-breakpoint
UPDATE "custom_orders" SET "status" = 'sent' WHERE "status" = 'ready';--> statement-breakpoint
UPDATE "custom_orders" SET "status" = 'deal' WHERE "status" = 'delivered';--> statement-breakpoint
UPDATE "custom_orders" SET "status" = 'lost' WHERE "status" = 'cancelled';--> statement-breakpoint
ALTER TABLE "custom_orders" ADD COLUMN IF NOT EXISTS "project_id" integer;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "custom_orders" ADD CONSTRAINT "custom_orders_project_id_products_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."products"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "custom_orders_project_id_uidx" ON "custom_orders" ("project_id") WHERE "project_id" IS NOT NULL;--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."custom_order_line_type" AS ENUM('catalog', 'service');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "custom_order_lines" (
	"id" serial PRIMARY KEY NOT NULL,
	"custom_order_id" integer NOT NULL,
	"line_type" "custom_order_line_type" DEFAULT 'catalog' NOT NULL,
	"catalog_item_id" integer,
	"name" text NOT NULL,
	"code" text,
	"quantity" real DEFAULT 1 NOT NULL,
	"cost_price" integer DEFAULT 0 NOT NULL,
	"sale_price" integer DEFAULT 0 NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "custom_order_lines" ADD CONSTRAINT "custom_order_lines_custom_order_id_custom_orders_id_fk" FOREIGN KEY ("custom_order_id") REFERENCES "public"."custom_orders"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "custom_order_lines" ADD CONSTRAINT "custom_order_lines_catalog_item_id_supplier_catalog_items_id_fk" FOREIGN KEY ("catalog_item_id") REFERENCES "public"."supplier_catalog_items"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "custom_order_lines_custom_order_id_idx" ON "custom_order_lines" ("custom_order_id");
