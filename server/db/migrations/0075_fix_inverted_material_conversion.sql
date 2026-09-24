UPDATE "materials"
SET
  "unit" = "purchase_unit",
  "purchase_unit" = "unit",
  "stock_quantity" = "stock_quantity" * "units_per_purchase",
  "price_per_unit" = CASE
    WHEN "units_per_purchase" > 1 THEN ROUND("price_per_unit"::numeric / "units_per_purchase")
    ELSE "price_per_unit"
  END
WHERE "units_per_purchase" > 1
  AND lower("unit") IN ('pack', 'box', 'roll')
  AND lower("purchase_unit") IN ('pcs', 'pc', 'buah', 'meter', 'm', 'mtr', 'gram', 'gr', 'ml');
