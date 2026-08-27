ALTER TYPE "public"."product_status" ADD VALUE IF NOT EXISTS 'waiting';--> statement-breakpoint
ALTER TYPE "public"."product_status" ADD VALUE IF NOT EXISTS 'in_progress';--> statement-breakpoint
ALTER TYPE "public"."product_status" ADD VALUE IF NOT EXISTS 'done';
