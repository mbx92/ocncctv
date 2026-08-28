CREATE TABLE IF NOT EXISTS "technicians" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "technicians_name_unique" UNIQUE("name")
);--> statement-breakpoint
INSERT INTO "technicians" ("name")
SELECT DISTINCT trim("name") FROM "project_technician_wages"
WHERE trim("name") <> ''
ON CONFLICT ("name") DO NOTHING;--> statement-breakpoint
ALTER TABLE "project_technician_wages" ADD COLUMN "technician_id" integer;--> statement-breakpoint
UPDATE "project_technician_wages" AS w
SET "technician_id" = t.id
FROM "technicians" AS t
WHERE t.name = w.name;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "project_technician_wages" ADD CONSTRAINT "project_technician_wages_technician_id_technicians_id_fk" FOREIGN KEY ("technician_id") REFERENCES "public"."technicians"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "project_technician_wages_technician_id_idx" ON "project_technician_wages" ("technician_id");--> statement-breakpoint
ALTER TABLE "expenses" ADD COLUMN "technician_id" integer;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "expenses" ADD CONSTRAINT "expenses_technician_id_technicians_id_fk" FOREIGN KEY ("technician_id") REFERENCES "public"."technicians"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "expenses_technician_id_idx" ON "expenses" ("technician_id");--> statement-breakpoint
INSERT INTO "expense_categories" ("key", "name", "is_system", "sort_order") VALUES
	('technician', 'Upah teknisi', true, 55)
ON CONFLICT ("key") DO NOTHING;
