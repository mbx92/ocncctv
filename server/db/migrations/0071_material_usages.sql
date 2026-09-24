CREATE TABLE IF NOT EXISTS "material_usages" (
	"id" serial PRIMARY KEY NOT NULL,
	"date" date NOT NULL,
	"material_id" integer NOT NULL,
	"product_id" integer NOT NULL,
	"quantity" integer DEFAULT 0 NOT NULL,
	"unit_price" integer DEFAULT 0 NOT NULL,
	"amount" integer DEFAULT 0 NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "material_usages" ADD CONSTRAINT "material_usages_material_id_materials_id_fk" FOREIGN KEY ("material_id") REFERENCES "public"."materials"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "material_usages" ADD CONSTRAINT "material_usages_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "material_usages_product_id_idx" ON "material_usages" ("product_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "material_usages_material_id_idx" ON "material_usages" ("material_id");
