ALTER TABLE "worker" DROP CONSTRAINT "worker_society_id_societies_id_fk";--> statement-breakpoint
ALTER TABLE "corporate" DROP CONSTRAINT "corporate_society_id_societies_id_fk";--> statement-breakpoint
ALTER TABLE "bookings" DROP CONSTRAINT "bookings_society_id_societies_id_fk";--> statement-breakpoint
DROP INDEX "worker_society_status_available_idx";--> statement-breakpoint
DROP INDEX "corporate_society_idx";--> statement-breakpoint
DROP INDEX "bookings_society_created_idx";--> statement-breakpoint
ALTER TABLE "worker" DROP COLUMN "society_id";--> statement-breakpoint
ALTER TABLE "corporate" DROP COLUMN "society_id";--> statement-breakpoint
ALTER TABLE "bookings" DROP COLUMN "society_id";--> statement-breakpoint
DROP TABLE "societies";--> statement-breakpoint
CREATE INDEX "worker_status_available_idx" ON "worker" USING btree ("status","available");--> statement-breakpoint
CREATE INDEX "bookings_created_idx" ON "bookings" USING btree ("created_at");
