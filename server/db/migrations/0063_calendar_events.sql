CREATE TABLE IF NOT EXISTS "calendar_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"date" date NOT NULL,
	"kind" text DEFAULT 'survey' NOT NULL,
	"title" text NOT NULL,
	"customer_name" text,
	"notes" text,
	"custom_order_id" integer,
	"product_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "calendar_events_date_idx" ON "calendar_events" ("date");--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_custom_order_id_custom_orders_id_fk" FOREIGN KEY ("custom_order_id") REFERENCES "public"."custom_orders"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
