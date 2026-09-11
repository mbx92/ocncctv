DO $$ BEGIN
 CREATE TYPE "public"."job_type" AS ENUM('install', 'maintenance');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "job_type" "job_type";--> statement-breakpoint
ALTER TABLE "custom_orders" ADD COLUMN IF NOT EXISTS "job_type" "job_type";
