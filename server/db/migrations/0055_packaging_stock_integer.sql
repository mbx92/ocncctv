UPDATE "packaging" SET "stock_quantity" = ROUND("stock_quantity");--> statement-breakpoint
ALTER TABLE "packaging" ALTER COLUMN "stock_quantity" TYPE integer USING ROUND("stock_quantity")::integer;
