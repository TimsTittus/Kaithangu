CREATE TYPE "public"."worker_availability_days" AS ENUM('weekdays', 'weekends', 'all_days');--> statement-breakpoint
CREATE TYPE "public"."worker_availability_hours" AS ENUM('mornings', 'afternoons', 'evenings', 'full_day');--> statement-breakpoint
CREATE TYPE "public"."worker_certification_status" AS ENUM('not_required', 'pending_upload', 'pending_review');--> statement-breakpoint
CREATE TYPE "public"."worker_onboarding_step" AS ENUM('name', 'language', 'smartphone', 'trades', 'skills', 'service_area', 'availability', 'payout', 'certification', 'consent', 'fairness', 'confirmation');--> statement-breakpoint
CREATE TYPE "public"."worker_registration_status" AS ENUM('in_progress', 'submitted');--> statement-breakpoint
ALTER TYPE "public"."consent_purpose" ADD VALUE 'worker_data_use';--> statement-breakpoint
ALTER TYPE "public"."consent_purpose" ADD VALUE 'call_recording_retention';--> statement-breakpoint
CREATE TABLE "worker_service_areas" (
	"worker_id" uuid NOT NULL,
	"position" smallint NOT NULL,
	"pincode" text NOT NULL,
	"location" geometry(Point,4326),
	"needs_followup" boolean DEFAULT false NOT NULL,
	CONSTRAINT "worker_service_areas_worker_id_position_pk" PRIMARY KEY("worker_id","position"),
	CONSTRAINT "worker_service_areas_worker_pincode_unique" UNIQUE("worker_id","pincode"),
	CONSTRAINT "worker_service_areas_position_range" CHECK ("worker_service_areas"."position" BETWEEN 1 AND 2),
	CONSTRAINT "worker_service_areas_pincode_format" CHECK ("worker_service_areas"."pincode" ~ '^[1-9][0-9]{5}$')
);
--> statement-breakpoint
ALTER TABLE "worker" ADD COLUMN "registration_status" "worker_registration_status" DEFAULT 'in_progress' NOT NULL;--> statement-breakpoint
UPDATE "worker" SET "registration_status" = 'submitted' WHERE "status" IN ('verified', 'suspended');--> statement-breakpoint
ALTER TABLE "worker" ADD COLUMN "onboarding_step" "worker_onboarding_step";--> statement-breakpoint
ALTER TABLE "worker" ADD COLUMN "service_radius_km" smallint;--> statement-breakpoint
ALTER TABLE "worker" ADD COLUMN "availability_days" "worker_availability_days";--> statement-breakpoint
ALTER TABLE "worker" ADD COLUMN "availability_hours" "worker_availability_hours";--> statement-breakpoint
ALTER TABLE "worker" ADD COLUMN "upi_id" text;--> statement-breakpoint
ALTER TABLE "worker" ADD COLUMN "certification_status" "worker_certification_status";--> statement-breakpoint
ALTER TABLE "worker" ADD COLUMN "consent_data_use" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "worker" ADD COLUMN "consent_recording_retention" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "worker" ADD COLUMN "fairness_explained" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "worker" ADD COLUMN "identity_verified_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "worker" ADD COLUMN "submitted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "worker" ADD COLUMN "last_interaction_id" text;--> statement-breakpoint
ALTER TABLE "worker_service_areas" ADD CONSTRAINT "worker_service_areas_worker_id_worker_id_fk" FOREIGN KEY ("worker_id") REFERENCES "public"."worker"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "worker_service_areas_pincode_idx" ON "worker_service_areas" USING btree ("pincode");--> statement-breakpoint
CREATE INDEX "worker_registration_status_idx" ON "worker" USING btree ("registration_status");--> statement-breakpoint
ALTER TABLE "worker" ADD CONSTRAINT "worker_service_radius_preset" CHECK ("worker"."service_radius_km" IS NULL OR "worker"."service_radius_km" IN (2, 5, 10));--> statement-breakpoint
ALTER TABLE "worker" ADD CONSTRAINT "worker_upi_vpa" CHECK ("worker"."upi_id" IS NULL OR "worker"."upi_id" ~ '^[a-zA-Z0-9._-]{2,256}@[a-zA-Z][a-zA-Z0-9.-]{1,63}$');--> statement-breakpoint
UPDATE "trades" SET "certified_required" = true WHERE "code" IN ('plumber', 'electrician', 'technician');--> statement-breakpoint
UPDATE "trades" SET "certified_required" = false WHERE "code" NOT IN ('plumber', 'electrician', 'technician');