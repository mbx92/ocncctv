ALTER TABLE "machines" ADD COLUMN IF NOT EXISTS "quantity" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
UPDATE "machines" SET "quantity" = 1 WHERE "quantity" IS NULL OR "quantity" < 1;
