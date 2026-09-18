-- Role teknisi + tautan akun ke master teknisi.
ALTER TYPE "public"."user_role" ADD VALUE IF NOT EXISTS 'technician';--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "technician_id" integer;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "users" ADD CONSTRAINT "users_technician_id_technicians_id_fk" FOREIGN KEY ("technician_id") REFERENCES "public"."technicians"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "users_technician_id_uidx" ON "users" ("technician_id");
