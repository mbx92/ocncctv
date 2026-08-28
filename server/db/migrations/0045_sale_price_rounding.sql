ALTER TABLE "app_settings" ADD COLUMN IF NOT EXISTS "sale_price_rounding" integer DEFAULT 500 NOT NULL;
