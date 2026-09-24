CREATE TABLE IF NOT EXISTS "packaging_lots" (
	"id" serial PRIMARY KEY NOT NULL,
	"packaging_id" integer NOT NULL,
	"origin_project_id" integer,
	"purchase_line_id" integer,
	"source" text DEFAULT 'purchase' NOT NULL,
	"quantity_in" integer DEFAULT 0 NOT NULL,
	"received_date" date NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "packaging_lot_moves" (
	"id" serial PRIMARY KEY NOT NULL,
	"lot_id" integer NOT NULL,
	"project_id" integer,
	"quantity" integer DEFAULT 0 NOT NULL,
	"date" date NOT NULL,
	"affects_stock" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "packaging_lots" ADD CONSTRAINT "packaging_lots_packaging_id_packaging_id_fk" FOREIGN KEY ("packaging_id") REFERENCES "public"."packaging"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "packaging_lots" ADD CONSTRAINT "packaging_lots_origin_project_id_products_id_fk" FOREIGN KEY ("origin_project_id") REFERENCES "public"."products"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "packaging_lots" ADD CONSTRAINT "packaging_lots_purchase_line_id_supplier_purchase_lines_id_fk" FOREIGN KEY ("purchase_line_id") REFERENCES "public"."supplier_purchase_lines"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "packaging_lot_moves" ADD CONSTRAINT "packaging_lot_moves_lot_id_packaging_lots_id_fk" FOREIGN KEY ("lot_id") REFERENCES "public"."packaging_lots"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "packaging_lot_moves" ADD CONSTRAINT "packaging_lot_moves_project_id_products_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."products"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "packaging_lots_purchase_line_uidx" ON "packaging_lots" ("purchase_line_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "packaging_lots_packaging_id_idx" ON "packaging_lots" ("packaging_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "packaging_lot_moves_lot_id_idx" ON "packaging_lot_moves" ("lot_id");--> statement-breakpoint
INSERT INTO "packaging_lots" ("packaging_id", "origin_project_id", "purchase_line_id", "source", "quantity_in", "received_date")
SELECT l.packaging_id, pu.project_id, l.id, 'purchase',
	l.quantity * GREATEST(COALESCE(pk.units_per_purchase, 1), 1),
	pu.date
FROM "supplier_purchase_lines" l
JOIN "supplier_purchases" pu ON pu.id = l.purchase_id
JOIN "packaging" pk ON pk.id = l.packaging_id
WHERE l.item_type = 'packaging' AND l.packaging_id IS NOT NULL
ON CONFLICT ("purchase_line_id") DO NOTHING;--> statement-breakpoint
INSERT INTO "packaging_lot_moves" ("lot_id", "project_id", "quantity", "date", "affects_stock")
SELECT lot.id, lot.origin_project_id,
	lot.quantity_in - (l.stock_quantity * GREATEST(COALESCE(pk.units_per_purchase, 1), 1)),
	lot.received_date,
	false
FROM "packaging_lots" lot
JOIN "supplier_purchase_lines" l ON l.id = lot.purchase_line_id
JOIN "packaging" pk ON pk.id = lot.packaging_id
WHERE lot.quantity_in > (l.stock_quantity * GREATEST(COALESCE(pk.units_per_purchase, 1), 1));--> statement-breakpoint
INSERT INTO "packaging_lots" ("packaging_id", "origin_project_id", "source", "quantity_in", "received_date")
SELECT pk.id, NULL, 'opening',
	pk.stock_quantity
		+ COALESCE((SELECT SUM(u.quantity) FROM "packaging_usages" u WHERE u.packaging_id = pk.id), 0)
		- COALESCE((
			SELECT SUM(l.stock_quantity * GREATEST(COALESCE(pk.units_per_purchase, 1), 1))
			FROM "supplier_purchase_lines" l
			WHERE l.packaging_id = pk.id AND l.item_type = 'packaging'
		), 0),
	CURRENT_DATE
FROM "packaging" pk
WHERE pk.stock_quantity
	+ COALESCE((SELECT SUM(u.quantity) FROM "packaging_usages" u WHERE u.packaging_id = pk.id), 0)
	- COALESCE((
		SELECT SUM(l.stock_quantity * GREATEST(COALESCE(pk.units_per_purchase, 1), 1))
		FROM "supplier_purchase_lines" l
		WHERE l.packaging_id = pk.id AND l.item_type = 'packaging'
	), 0) > 0;--> statement-breakpoint
INSERT INTO "packaging_lot_moves" ("lot_id", "project_id", "quantity", "date", "affects_stock")
SELECT lot.id, u.product_id, u.quantity, CURRENT_DATE, true
FROM "packaging_usages" u
JOIN "packaging_lots" lot ON lot.packaging_id = u.packaging_id AND lot.source = 'opening'
WHERE u.quantity > 0;
