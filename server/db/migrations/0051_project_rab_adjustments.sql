CREATE TABLE IF NOT EXISTS "project_rab_adjustments" (
	"id" serial PRIMARY KEY NOT NULL,
	"product_id" integer NOT NULL,
	"custom_order_line_id" integer NOT NULL,
	"quantity" real DEFAULT 0 NOT NULL
);--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "project_rab_adjustments" ADD CONSTRAINT "project_rab_adjustments_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "project_rab_adjustments" ADD CONSTRAINT "project_rab_adjustments_custom_order_line_id_custom_order_lines_id_fk" FOREIGN KEY ("custom_order_line_id") REFERENCES "public"."custom_order_lines"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "project_rab_adjustments_product_line_uidx" ON "project_rab_adjustments" ("product_id", "custom_order_line_id");
