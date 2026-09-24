ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "consumable_lot_sale" integer DEFAULT 50000 NOT NULL;
