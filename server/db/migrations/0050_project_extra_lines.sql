CREATE TABLE IF NOT EXISTS "project_extra_lines" (
	"id" serial PRIMARY KEY NOT NULL,
	"product_id" integer NOT NULL,
	"line_type" "custom_order_line_type" DEFAULT 'catalog' NOT NULL,
	"catalog_item_id" integer,
	"service_id" integer,
	"packaging_id" integer,
	"name" text NOT NULL,
	"code" text,
	"unit" text,
	"quantity" real DEFAULT 1 NOT NULL,
	"cost_price" integer DEFAULT 0 NOT NULL,
	"sale_price" integer DEFAULT 0 NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "project_extra_lines" ADD CONSTRAINT "project_extra_lines_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "project_extra_lines" ADD CONSTRAINT "project_extra_lines_catalog_item_id_supplier_catalog_items_id_fk" FOREIGN KEY ("catalog_item_id") REFERENCES "public"."supplier_catalog_items"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "project_extra_lines" ADD CONSTRAINT "project_extra_lines_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "project_extra_lines" ADD CONSTRAINT "project_extra_lines_packaging_id_packaging_id_fk" FOREIGN KEY ("packaging_id") REFERENCES "public"."packaging"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "project_extra_lines_product_id_idx" ON "project_extra_lines" ("product_id");
