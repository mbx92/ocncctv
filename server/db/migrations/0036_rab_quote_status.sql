-- Status RAB: Draft → Dikirim → Deal / Tidak deal.
-- Hanya ADD VALUE di migrasi ini. Pemakaian nilai baru di 0037 setelah commit.
ALTER TYPE "public"."custom_order_status" ADD VALUE IF NOT EXISTS 'draft';--> statement-breakpoint
ALTER TYPE "public"."custom_order_status" ADD VALUE IF NOT EXISTS 'sent';--> statement-breakpoint
ALTER TYPE "public"."custom_order_status" ADD VALUE IF NOT EXISTS 'deal';--> statement-breakpoint
ALTER TYPE "public"."custom_order_status" ADD VALUE IF NOT EXISTS 'lost';
