CREATE TABLE IF NOT EXISTS "rab_share_links" (
	"id" serial PRIMARY KEY NOT NULL,
	"custom_order_id" integer NOT NULL,
	"token" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "rab_share_links" ADD CONSTRAINT "rab_share_links_custom_order_id_custom_orders_id_fk" FOREIGN KEY ("custom_order_id") REFERENCES "public"."custom_orders"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "rab_share_links_token_uidx" ON "rab_share_links" ("token");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "rab_share_links_custom_order_id_idx" ON "rab_share_links" ("custom_order_id");
