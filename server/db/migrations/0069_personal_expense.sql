INSERT INTO "expense_categories" ("key", "name", "is_system", "sort_order", "color")
SELECT 'pribadi', 'Pribadi', true, 85, '#be123c'
WHERE NOT EXISTS (
  SELECT 1 FROM "expense_categories"
  WHERE "key" = 'pribadi' OR lower("name") LIKE '%pribadi%'
);
