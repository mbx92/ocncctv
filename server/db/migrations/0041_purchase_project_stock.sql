ALTER TABLE "supplier_purchases" ADD COLUMN IF NOT EXISTS "project_id" integer;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "supplier_purchases" ADD CONSTRAINT "supplier_purchases_project_id_products_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."products"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
ALTER TABLE "supplier_purchase_lines" ADD COLUMN IF NOT EXISTS "stock_quantity" real;--> statement-breakpoint
UPDATE "supplier_purchase_lines" SET "stock_quantity" = "quantity" WHERE "stock_quantity" IS NULL;--> statement-breakpoint
ALTER TABLE "supplier_purchase_lines" ALTER COLUMN "stock_quantity" SET DEFAULT 0;--> statement-breakpoint
ALTER TABLE "supplier_purchase_lines" ALTER COLUMN "stock_quantity" SET NOT NULL;
