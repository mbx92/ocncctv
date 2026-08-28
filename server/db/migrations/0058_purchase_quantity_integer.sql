UPDATE "supplier_purchase_lines" SET "quantity" = ROUND("quantity"), "stock_quantity" = ROUND("stock_quantity");--> statement-breakpoint
ALTER TABLE "supplier_purchase_lines" ALTER COLUMN "quantity" TYPE integer USING ROUND("quantity")::integer;--> statement-breakpoint
ALTER TABLE "supplier_purchase_lines" ALTER COLUMN "stock_quantity" TYPE integer USING ROUND("stock_quantity")::integer;
