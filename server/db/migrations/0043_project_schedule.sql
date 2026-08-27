ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "planned_start_date" date;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "started_at" date;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "completed_at" date;--> statement-breakpoint
UPDATE "products" SET "status" = 'waiting' WHERE "status" IN ('draft', 'rnd');--> statement-breakpoint
UPDATE "products" SET "status" = 'in_progress' WHERE "status" = 'active';--> statement-breakpoint
UPDATE "products" SET "status" = 'done' WHERE "status" = 'discontinued';--> statement-breakpoint
ALTER TABLE "products" ALTER COLUMN "status" SET DEFAULT 'waiting';
