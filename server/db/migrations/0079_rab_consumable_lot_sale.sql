ALTER TABLE "custom_orders" ADD COLUMN IF NOT EXISTS "consumable_lot_sale" integer DEFAULT 50000 NOT NULL;
--> statement-breakpoint
UPDATE "custom_orders" AS co
SET "consumable_lot_sale" = p."consumable_lot_sale"
FROM "products" AS p
WHERE co."project_id" = p.id;
