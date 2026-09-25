ALTER TABLE "sales" ADD COLUMN IF NOT EXISTS "invoice_locked" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
-- INGKA Kedampang sudah dibayar di invoice lama (Rp 21.722.500, ada penyesuaian).
-- Kunci nilai itu; jika sempat dihitung ulang ke 21.922.500, kembalikan.
UPDATE "sales" AS s
SET
  "invoice_locked" = true,
  "sale_price_per_unit" = CASE
    WHEN s."sale_price_per_unit" = 21922500 THEN 21722500
    ELSE s."sale_price_per_unit"
  END
FROM "products" AS p
WHERE s."product_id" = p."id"
  AND p."name" = 'Pasang CCTV 14 Titik'
  AND p."customer_name" ILIKE '%Kedampang%';
