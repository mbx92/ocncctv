ALTER TABLE "machines" DROP COLUMN IF EXISTS "tuya_ip";--> statement-breakpoint
ALTER TABLE "machines" DROP COLUMN IF EXISTS "tuya_device_id";--> statement-breakpoint
ALTER TABLE "machines" DROP COLUMN IF EXISTS "tuya_local_key";--> statement-breakpoint
ALTER TABLE "machines" DROP COLUMN IF EXISTS "tuya_version";--> statement-breakpoint
ALTER TABLE "machines" DROP COLUMN IF EXISTS "tuya_last_power_watt";--> statement-breakpoint
ALTER TABLE "machines" DROP COLUMN IF EXISTS "tuya_last_voltage";--> statement-breakpoint
ALTER TABLE "machines" DROP COLUMN IF EXISTS "tuya_last_current_ma";--> statement-breakpoint
ALTER TABLE "machines" DROP COLUMN IF EXISTS "tuya_last_on";--> statement-breakpoint
ALTER TABLE "machines" DROP COLUMN IF EXISTS "tuya_last_read_at";--> statement-breakpoint
ALTER TABLE "machines" DROP COLUMN IF EXISTS "tuya_last_error";
