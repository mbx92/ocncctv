-- Invoice INGKA Kedampang yang sudah dibayar: selisih 200.000 jadi diskon, bukan baris penyesuaian.
UPDATE "sales" AS s
SET
  "sale_price_per_unit" = 21922500,
  "discount_amount" = COALESCE(s."discount_amount", 0) + 200000,
  "discount_kind" = 'amount',
  "discount_percent" = ROUND((200000::numeric / 21922500) * 1000) / 10,
  "invoice_locked" = true
FROM "products" AS p
WHERE s."product_id" = p."id"
  AND p."name" = 'Pasang CCTV 14 Titik'
  AND p."customer_name" ILIKE '%Kedampang%'
  AND s."sale_price_per_unit" = 21722500;
