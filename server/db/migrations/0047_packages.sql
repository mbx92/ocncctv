ALTER TYPE "public"."custom_order_line_type" ADD VALUE IF NOT EXISTS 'product';--> statement-breakpoint
ALTER TABLE "custom_order_lines" ADD COLUMN IF NOT EXISTS "packaging_id" integer;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "custom_order_lines" ADD CONSTRAINT "custom_order_lines_packaging_id_packaging_id_fk" FOREIGN KEY ("packaging_id") REFERENCES "public"."packaging"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "custom_order_lines_packaging_id_idx" ON "custom_order_lines" ("packaging_id");--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "packages" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "package_lines" (
	"id" serial PRIMARY KEY NOT NULL,
	"package_id" integer NOT NULL,
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
 ALTER TABLE "package_lines" ADD CONSTRAINT "package_lines_package_id_packages_id_fk" FOREIGN KEY ("package_id") REFERENCES "public"."packages"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "package_lines" ADD CONSTRAINT "package_lines_catalog_item_id_supplier_catalog_items_id_fk" FOREIGN KEY ("catalog_item_id") REFERENCES "public"."supplier_catalog_items"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "package_lines" ADD CONSTRAINT "package_lines_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "package_lines" ADD CONSTRAINT "package_lines_packaging_id_packaging_id_fk" FOREIGN KEY ("packaging_id") REFERENCES "public"."packaging"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "package_lines_package_id_idx" ON "package_lines" ("package_id");--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "package_share_links" (
	"id" serial PRIMARY KEY NOT NULL,
	"package_id" integer NOT NULL,
	"token" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "package_share_links" ADD CONSTRAINT "package_share_links_package_id_packages_id_fk" FOREIGN KEY ("package_id") REFERENCES "public"."packages"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "package_share_links_token_uidx" ON "package_share_links" ("token");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "package_share_links_package_id_idx" ON "package_share_links" ("package_id");
