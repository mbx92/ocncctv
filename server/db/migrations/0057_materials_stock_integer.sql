UPDATE "materials" SET "stock_quantity" = ROUND("stock_quantity"), "low_stock_quantity" = ROUND("low_stock_quantity");--> statement-breakpoint
ALTER TABLE "materials" ALTER COLUMN "stock_quantity" TYPE integer USING ROUND("stock_quantity")::integer;--> statement-breakpoint
ALTER TABLE "materials" ALTER COLUMN "low_stock_quantity" TYPE integer USING ROUND("low_stock_quantity")::integer;
