CREATE TABLE IF NOT EXISTS "services" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"unit" text DEFAULT 'titik' NOT NULL,
	"sale_price" integer DEFAULT 0 NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint
ALTER TABLE "custom_order_lines" ADD COLUMN IF NOT EXISTS "service_id" integer;--> statement-breakpoint
ALTER TABLE "custom_order_lines" ADD COLUMN IF NOT EXISTS "unit" text;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "custom_order_lines" ADD CONSTRAINT "custom_order_lines_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
INSERT INTO "services" ("name", "unit", "sale_price")
SELECT v.name, v.unit, v.sale_price
FROM (
  VALUES
    ('Survey lokasi', 'paket', 0),
    ('Pasang kamera', 'titik', 0),
    ('Tarik kabel', 'titik', 0),
    ('Instalasi NVR / DVR', 'paket', 0),
    ('Setting remote HP', 'paket', 0),
    ('Konfigurasi jaringan', 'paket', 0),
    ('Relokasi kamera', 'titik', 0),
    ('Maintenance', 'paket', 0)
) AS v(name, unit, sale_price)
WHERE NOT EXISTS (SELECT 1 FROM "services" LIMIT 1);
