CREATE TABLE IF NOT EXISTS "supplier_catalog_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"ref" text NOT NULL,
	"sheet_key" text NOT NULL,
	"sheet_label" text NOT NULL,
	"supplier_name" text NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"category" text,
	"supplier_price" integer DEFAULT 0 NOT NULL,
	"last_price" integer,
	"last_synced_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "supplier_catalog_items_ref_uidx" ON "supplier_catalog_items" ("ref");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "supplier_catalog_items_sheet_key_idx" ON "supplier_catalog_items" ("sheet_key");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "supplier_catalog_items_sheet_code_idx" ON "supplier_catalog_items" ("sheet_key","code");
