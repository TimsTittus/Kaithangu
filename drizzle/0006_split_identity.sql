-- Split identity: users+workers → "user" / worker / corporate (exclusive phone).
CREATE TABLE "user" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"phone" text NOT NULL,
	"name" text,
	"locale" text,
	"session_version" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"state_code" text,
	CONSTRAINT "user_phone_unique" UNIQUE("phone"),
	CONSTRAINT "user_phone_e164" CHECK ("user"."phone" ~ '^\+[1-9][0-9]{7,14}$')
);
--> statement-breakpoint
CREATE TABLE "worker" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"phone" text NOT NULL,
	"name" text,
	"locale" text,
	"session_version" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"society_id" uuid,
	"status" "worker_status" DEFAULT 'pending' NOT NULL,
	"available" boolean DEFAULT false NOT NULL,
	"has_smartphone" boolean DEFAULT false NOT NULL,
	"rating_sum" integer DEFAULT 0 NOT NULL,
	"rating_count" integer DEFAULT 0 NOT NULL,
	"qr_key_version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "worker_phone_unique" UNIQUE("phone"),
	CONSTRAINT "worker_phone_e164" CHECK ("worker"."phone" ~ '^\+[1-9][0-9]{7,14}$'),
	CONSTRAINT "worker_rating_consistent" CHECK ("worker"."rating_count" >= 0 AND "worker"."rating_sum" BETWEEN "worker"."rating_count" AND 5 * "worker"."rating_count")
);
--> statement-breakpoint
CREATE TABLE "corporate" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"phone" text NOT NULL,
	"name" text,
	"locale" text,
	"session_version" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"society_id" uuid,
	CONSTRAINT "corporate_phone_unique" UNIQUE("phone"),
	CONSTRAINT "corporate_phone_e164" CHECK ("corporate"."phone" ~ '^\+[1-9][0-9]{7,14}$')
);
--> statement-breakpoint
INSERT INTO "user" ("id", "phone", "name", "locale", "session_version", "created_at", "state_code")
SELECT "id", "phone", "name", "locale", "session_version", "created_at", "state_code"
FROM "users"
WHERE "role" = 'user';
--> statement-breakpoint
INSERT INTO "corporate" ("id", "phone", "name", "locale", "session_version", "created_at", "society_id")
SELECT "id", "phone", "name", "locale", "session_version", "created_at", "society_id"
FROM "users"
WHERE "role" = 'corporate';
--> statement-breakpoint
INSERT INTO "worker" (
	"id", "phone", "name", "locale", "session_version", "created_at",
	"society_id", "status", "available", "has_smartphone", "rating_sum", "rating_count", "qr_key_version"
)
SELECT
	u."id", u."phone", u."name", u."locale", u."session_version", u."created_at",
	COALESCE(w."society_id", u."society_id"),
	COALESCE(w."status", 'pending'::"worker_status"),
	COALESCE(w."available", false),
	COALESCE(w."has_smartphone", false),
	COALESCE(w."rating_sum", 0),
	COALESCE(w."rating_count", 0),
	COALESCE(w."qr_key_version", 1)
FROM "users" u
LEFT JOIN "workers" w ON w."user_id" = u."id"
WHERE u."role" = 'worker';
--> statement-breakpoint
ALTER TABLE "user" ADD CONSTRAINT "user_state_code_states_code_fk" FOREIGN KEY ("state_code") REFERENCES "public"."states"("code") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "worker" ADD CONSTRAINT "worker_society_id_societies_id_fk" FOREIGN KEY ("society_id") REFERENCES "public"."societies"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "corporate" ADD CONSTRAINT "corporate_society_id_societies_id_fk" FOREIGN KEY ("society_id") REFERENCES "public"."societies"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "user_state_idx" ON "user" USING btree ("state_code");
--> statement-breakpoint
CREATE INDEX "worker_society_status_available_idx" ON "worker" USING btree ("society_id","status","available");
--> statement-breakpoint
CREATE INDEX "corporate_society_idx" ON "corporate" USING btree ("society_id");
--> statement-breakpoint
ALTER TABLE "addresses" DROP CONSTRAINT "addresses_user_id_users_id_fk";
--> statement-breakpoint
DELETE FROM "addresses" WHERE "user_id" NOT IN (SELECT "id" FROM "user");
--> statement-breakpoint
ALTER TABLE "addresses" DROP COLUMN "label";
--> statement-breakpoint
ALTER TABLE "addresses" ADD CONSTRAINT "addresses_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "consents" DROP CONSTRAINT "consents_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "consents" ADD COLUMN "actor_role" "user_role";
--> statement-breakpoint
ALTER TABLE "consents" ADD COLUMN "actor_id" uuid;
--> statement-breakpoint
UPDATE "consents" AS c SET "actor_role" = u."role", "actor_id" = c."user_id" FROM "users" u WHERE u."id" = c."user_id";
--> statement-breakpoint
DELETE FROM "consents" WHERE "purpose"::text <> 'platform_terms' OR "actor_role" IS NULL OR "actor_id" IS NULL;
--> statement-breakpoint
ALTER TABLE "consents" ALTER COLUMN "actor_role" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "consents" ALTER COLUMN "actor_id" SET NOT NULL;
--> statement-breakpoint
DROP INDEX "consents_user_purpose_idx";
--> statement-breakpoint
ALTER TABLE "consents" DROP COLUMN "user_id";
--> statement-breakpoint
ALTER TABLE "consents" DROP COLUMN "channel";
--> statement-breakpoint
CREATE INDEX "consents_actor_purpose_idx" ON "consents" USING btree ("actor_role","actor_id","purpose");
--> statement-breakpoint
CREATE TYPE "public"."consent_purpose_new" AS ENUM('platform_terms');
--> statement-breakpoint
ALTER TABLE "consents" ALTER COLUMN "purpose" SET DATA TYPE "public"."consent_purpose_new" USING "purpose"::text::"public"."consent_purpose_new";
--> statement-breakpoint
DROP TYPE "public"."consent_purpose";
--> statement-breakpoint
ALTER TYPE "public"."consent_purpose_new" RENAME TO "consent_purpose";
--> statement-breakpoint
ALTER TABLE "booking_events" DROP CONSTRAINT "booking_events_actor_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "booking_events" DROP CONSTRAINT "booking_events_has_actor";
--> statement-breakpoint
ALTER TABLE "booking_events" ADD COLUMN "actor_role" "user_role";
--> statement-breakpoint
ALTER TABLE "booking_events" ADD COLUMN "actor_id" uuid;
--> statement-breakpoint
UPDATE "booking_events" AS e SET "actor_role" = u."role", "actor_id" = e."actor_user_id" FROM "users" u WHERE u."id" = e."actor_user_id";
--> statement-breakpoint
ALTER TABLE "booking_events" DROP COLUMN "actor_user_id";
--> statement-breakpoint
ALTER TABLE "booking_events" ADD CONSTRAINT "booking_events_has_actor" CHECK (("booking_events"."actor_role" IS NOT NULL AND "booking_events"."actor_id" IS NOT NULL) OR "booking_events"."actor_system" IS NOT NULL);
--> statement-breakpoint
ALTER TABLE "bookings" DROP CONSTRAINT "bookings_customer_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "bookings" DROP CONSTRAINT "bookings_worker_id_workers_user_id_fk";
--> statement-breakpoint
ALTER TABLE "bookings" DROP CONSTRAINT "bookings_institution_id_institutions_id_fk";
--> statement-breakpoint
ALTER TABLE "bookings" DROP CONSTRAINT "bookings_otp_attempts_range";
--> statement-breakpoint
DELETE FROM "booking_events" WHERE "booking_id" IN (SELECT "id" FROM "bookings" WHERE "customer_id" NOT IN (SELECT "id" FROM "user"));
--> statement-breakpoint
DELETE FROM "bookings" WHERE "customer_id" NOT IN (SELECT "id" FROM "user");
--> statement-breakpoint
UPDATE "bookings" SET "worker_id" = NULL WHERE "worker_id" IS NOT NULL AND "worker_id" NOT IN (SELECT "id" FROM "worker");
--> statement-breakpoint
ALTER TABLE "bookings" DROP COLUMN "institution_id";
--> statement-breakpoint
ALTER TABLE "bookings" DROP COLUMN "problem_summary_en";
--> statement-breakpoint
ALTER TABLE "bookings" DROP COLUMN "source";
--> statement-breakpoint
ALTER TABLE "bookings" DROP COLUMN "start_otp_hash";
--> statement-breakpoint
ALTER TABLE "bookings" DROP COLUMN "complete_otp_hash";
--> statement-breakpoint
ALTER TABLE "bookings" DROP COLUMN "start_otp_attempts";
--> statement-breakpoint
ALTER TABLE "bookings" DROP COLUMN "complete_otp_attempts";
--> statement-breakpoint
ALTER TABLE "bookings" DROP COLUMN "otp_locked_at";
--> statement-breakpoint
ALTER TABLE "bookings" DROP COLUMN "started_at";
--> statement-breakpoint
ALTER TABLE "bookings" DROP COLUMN "completed_at";
--> statement-breakpoint
ALTER TABLE "bookings" DROP COLUMN "updated_at";
--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_customer_id_user_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_worker_id_worker_id_fk" FOREIGN KEY ("worker_id") REFERENCES "public"."worker"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "worker_skills" DROP CONSTRAINT "worker_skills_worker_id_workers_user_id_fk";
--> statement-breakpoint
ALTER TABLE "worker_skills" DROP CONSTRAINT "worker_skills_years_non_negative";
--> statement-breakpoint
DELETE FROM "worker_skills" WHERE "worker_id" NOT IN (SELECT "id" FROM "worker");
--> statement-breakpoint
ALTER TABLE "worker_skills" DROP COLUMN "years";
--> statement-breakpoint
ALTER TABLE "worker_skills" DROP COLUMN "source";
--> statement-breakpoint
ALTER TABLE "worker_skills" ADD CONSTRAINT "worker_skills_worker_id_worker_id_fk" FOREIGN KEY ("worker_id") REFERENCES "public"."worker"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
DROP INDEX "societies_location_gist";
--> statement-breakpoint
ALTER TABLE "societies" DROP COLUMN "district";
--> statement-breakpoint
ALTER TABLE "societies" DROP COLUMN "reg_no";
--> statement-breakpoint
ALTER TABLE "societies" DROP COLUMN "location";
--> statement-breakpoint
ALTER TABLE "societies" DROP COLUMN "is_demo";
--> statement-breakpoint
DROP TABLE "workers" CASCADE;
--> statement-breakpoint
DROP TABLE "users" CASCADE;
--> statement-breakpoint
DROP TABLE "institutions" CASCADE;
--> statement-breakpoint
DROP TYPE "public"."booking_source";
--> statement-breakpoint
DROP TYPE "public"."consent_channel";
--> statement-breakpoint
DROP TYPE "public"."institution_type";
--> statement-breakpoint
DROP TYPE "public"."skill_source";
--> statement-breakpoint
CREATE OR REPLACE FUNCTION enforce_exclusive_phone() RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
	IF TG_TABLE_NAME = 'user' THEN
		IF EXISTS (SELECT 1 FROM "worker" WHERE "phone" = NEW."phone")
			OR EXISTS (SELECT 1 FROM "corporate" WHERE "phone" = NEW."phone") THEN
			RAISE EXCEPTION 'phone % already registered as another identity', NEW."phone"
				USING ERRCODE = 'unique_violation';
		END IF;
	ELSIF TG_TABLE_NAME = 'worker' THEN
		IF EXISTS (SELECT 1 FROM "user" WHERE "phone" = NEW."phone")
			OR EXISTS (SELECT 1 FROM "corporate" WHERE "phone" = NEW."phone") THEN
			RAISE EXCEPTION 'phone % already registered as another identity', NEW."phone"
				USING ERRCODE = 'unique_violation';
		END IF;
	ELSE
		IF EXISTS (SELECT 1 FROM "user" WHERE "phone" = NEW."phone")
			OR EXISTS (SELECT 1 FROM "worker" WHERE "phone" = NEW."phone") THEN
			RAISE EXCEPTION 'phone % already registered as another identity', NEW."phone"
				USING ERRCODE = 'unique_violation';
		END IF;
	END IF;
	RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER user_exclusive_phone BEFORE INSERT OR UPDATE OF "phone" ON "user"
FOR EACH ROW EXECUTE PROCEDURE enforce_exclusive_phone();
--> statement-breakpoint
CREATE TRIGGER worker_exclusive_phone BEFORE INSERT OR UPDATE OF "phone" ON "worker"
FOR EACH ROW EXECUTE PROCEDURE enforce_exclusive_phone();
--> statement-breakpoint
CREATE TRIGGER corporate_exclusive_phone BEFORE INSERT OR UPDATE OF "phone" ON "corporate"
FOR EACH ROW EXECUTE PROCEDURE enforce_exclusive_phone();
