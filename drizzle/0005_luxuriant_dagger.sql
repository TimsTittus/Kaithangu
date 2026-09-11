ALTER TABLE "federations" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "demand_forecasts" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "disaster_events" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "festivals" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "booking_offers" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "disputes" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "ratings" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "notifications" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "invoice_sequences" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "invoices" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "ledger_entries" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "ledger_head" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "payments" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "welfare_enrolments" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "welfare_schemes" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "call_sessions" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "federations" CASCADE;--> statement-breakpoint
DROP TABLE "demand_forecasts" CASCADE;--> statement-breakpoint
DROP TABLE "disaster_events" CASCADE;--> statement-breakpoint
DROP TABLE "festivals" CASCADE;--> statement-breakpoint
DROP TABLE "booking_offers" CASCADE;--> statement-breakpoint
DROP TABLE "disputes" CASCADE;--> statement-breakpoint
DROP TABLE "ratings" CASCADE;--> statement-breakpoint
DROP TABLE "notifications" CASCADE;--> statement-breakpoint
DROP TABLE "invoice_sequences" CASCADE;--> statement-breakpoint
DROP TABLE "invoices" CASCADE;--> statement-breakpoint
DROP TABLE "ledger_entries" CASCADE;--> statement-breakpoint
DROP TABLE "ledger_head" CASCADE;--> statement-breakpoint
DROP TABLE "payments" CASCADE;--> statement-breakpoint
DROP TABLE "welfare_enrolments" CASCADE;--> statement-breakpoint
DROP TABLE "welfare_schemes" CASCADE;--> statement-breakpoint
DROP TABLE "call_sessions" CASCADE;--> statement-breakpoint
ALTER TABLE "societies" DROP COLUMN "federation_id";--> statement-breakpoint
ALTER TABLE "bookings" DROP COLUMN "disaster_event_id";--> statement-breakpoint
DROP TYPE "public"."call_direction";--> statement-breakpoint
DROP TYPE "public"."call_purpose";--> statement-breakpoint
DROP TYPE "public"."dispute_status";--> statement-breakpoint
DROP TYPE "public"."enrolment_status";--> statement-breakpoint
DROP TYPE "public"."federation_level";--> statement-breakpoint
DROP TYPE "public"."ledger_direction";--> statement-breakpoint
DROP TYPE "public"."ledger_kind";--> statement-breakpoint
DROP TYPE "public"."notification_channel";--> statement-breakpoint
DROP TYPE "public"."offer_channel";--> statement-breakpoint
DROP TYPE "public"."offer_response";--> statement-breakpoint
DROP TYPE "public"."payment_method";--> statement-breakpoint
DROP TYPE "public"."payment_status";--> statement-breakpoint
DROP TYPE "public"."rating_channel";--> statement-breakpoint
DROP TYPE "public"."relief_rate_mode";--> statement-breakpoint
DROP TYPE "public"."sentiment";--> statement-breakpoint
DROP FUNCTION IF EXISTS ledger_entries_reject_mutation();
