CREATE TABLE IF NOT EXISTS "packaging_usages" (
	"id" serial PRIMARY KEY NOT NULL,
	"packaging_id" integer NOT NULL,
	"product_id" integer NOT NULL,
	"quantity" integer DEFAULT 0 NOT NULL
);--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "packaging_usages" ADD CONSTRAINT "packaging_usages_packaging_id_packaging_id_fk" FOREIGN KEY ("packaging_id") REFERENCES "public"."packaging"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "packaging_usages" ADD CONSTRAINT "packaging_usages_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "packaging_usages_product_packaging_uidx" ON "packaging_usages" ("product_id", "packaging_id");--> statement-breakpoint
INSERT INTO "packaging_usages" ("packaging_id", "product_id", "quantity")
SELECT used.packaging_id, used.product_id, used.quantity
FROM (
	SELECT l.packaging_id, o.project_id AS product_id,
		SUM(
			COALESCE(
				(
					SELECT a.quantity
					FROM "project_rab_adjustments" a
					WHERE a.product_id = o.project_id AND a.custom_order_line_id = l.id
				),
				l.quantity
			)
		)::int AS quantity
	FROM "custom_order_lines" l
	JOIN "custom_orders" o ON o.id = l.custom_order_id
	WHERE o.project_id IS NOT NULL
		AND l.line_type = 'product'
		AND l.packaging_id IS NOT NULL
	GROUP BY l.packaging_id, o.project_id
) used
WHERE used.quantity > 0
ON CONFLICT ("product_id", "packaging_id") DO UPDATE
SET "quantity" = "packaging_usages"."quantity" + EXCLUDED."quantity";--> statement-breakpoint
INSERT INTO "packaging_usages" ("packaging_id", "product_id", "quantity")
SELECT e.packaging_id, e.product_id, SUM(ROUND(e.quantity))::int
FROM "project_extra_lines" e
WHERE e.line_type = 'product' AND e.packaging_id IS NOT NULL
GROUP BY e.packaging_id, e.product_id
HAVING SUM(ROUND(e.quantity)) > 0
ON CONFLICT ("product_id", "packaging_id") DO UPDATE
SET "quantity" = "packaging_usages"."quantity" + EXCLUDED."quantity";--> statement-breakpoint
UPDATE "packaging" AS p
SET "stock_quantity" = p."stock_quantity" - u.quantity
FROM (
	SELECT "packaging_id", SUM("quantity") AS quantity
	FROM "packaging_usages"
	GROUP BY "packaging_id"
) u
WHERE p.id = u.packaging_id;
