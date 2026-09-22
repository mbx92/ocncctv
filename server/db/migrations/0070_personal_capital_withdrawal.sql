ALTER TABLE "capital_transactions" ADD COLUMN IF NOT EXISTS "expense_id" integer;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "capital_transactions" ADD CONSTRAINT "capital_transactions_expense_id_expenses_id_fk" FOREIGN KEY ("expense_id") REFERENCES "public"."expenses"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "capital_transactions_expense_id_uidx" ON "capital_transactions" ("expense_id");
