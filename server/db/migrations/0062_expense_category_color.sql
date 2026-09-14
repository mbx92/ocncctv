ALTER TABLE "expense_categories" ADD COLUMN IF NOT EXISTS "color" text;--> statement-breakpoint
UPDATE "expense_categories" SET "color" = '#0f766e' WHERE "key" = 'material' AND ("color" IS NULL OR "color" = '');--> statement-breakpoint
UPDATE "expense_categories" SET "color" = '#0369a1' WHERE "key" = 'packaging' AND ("color" IS NULL OR "color" = '');--> statement-breakpoint
UPDATE "expense_categories" SET "color" = '#57534e' WHERE "key" = 'tool' AND ("color" IS NULL OR "color" = '');--> statement-breakpoint
UPDATE "expense_categories" SET "color" = '#b45309' WHERE "key" = 'electricity' AND ("color" IS NULL OR "color" = '');--> statement-breakpoint
UPDATE "expense_categories" SET "color" = '#475569' WHERE "key" = 'machine' AND ("color" IS NULL OR "color" = '');--> statement-breakpoint
UPDATE "expense_categories" SET "color" = '#7e22ce' WHERE "key" = 'rnd' AND ("color" IS NULL OR "color" = '');--> statement-breakpoint
UPDATE "expense_categories" SET "color" = '#047857' WHERE "key" = 'technician' AND ("color" IS NULL OR "color" = '');--> statement-breakpoint
UPDATE "expense_categories" SET "color" = '#64748b' WHERE "key" = 'other' AND ("color" IS NULL OR "color" = '');
