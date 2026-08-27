ALTER TABLE "machines" ADD COLUMN IF NOT EXISTS "acquisition" text DEFAULT 'owned' NOT NULL;--> statement-breakpoint
UPDATE "machines" SET "acquisition" = 'purchased' WHERE "expense_id" IS NOT NULL;--> statement-breakpoint
UPDATE "expense_categories" SET "name" = 'Peralatan' WHERE "key" = 'machine';
