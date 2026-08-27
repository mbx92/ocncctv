-- Perlengkapan lapangan CCTV: status Ada/Menipis/Habis, bukan stok gram.
-- consumable hanya di-ADD di sini; default kolom type di 0033 setelah commit.
ALTER TYPE "public"."material_type" ADD VALUE IF NOT EXISTS 'consumable';--> statement-breakpoint
ALTER TABLE "materials" ADD COLUMN IF NOT EXISTS "stock_status" text DEFAULT 'ok' NOT NULL;
