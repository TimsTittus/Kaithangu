CREATE TYPE "public"."booking_source" AS ENUM('pwa', 'voice', 'institution', 'admin', 'ondc');--> statement-breakpoint
CREATE TYPE "public"."booking_status" AS ENUM('requested', 'matching', 'offered', 'accepted', 'en_route', 'in_progress', 'completed', 'unassigned', 'cancelled', 'disputed', 'resolved');--> statement-breakpoint
CREATE TYPE "public"."call_direction" AS ENUM('inbound', 'outbound');--> statement-breakpoint
CREATE TYPE "public"."call_purpose" AS ENUM('customer_booking', 'worker_offer', 'worker_availability', 'worker_job', 'onboarding', 'rating', 'status_update', 'broadcast');--> statement-breakpoint
CREATE TYPE "public"."consent_channel" AS ENUM('web', 'voice');--> statement-breakpoint
CREATE TYPE "public"."consent_purpose" AS ENUM('platform_terms', 'call_recording', 'data_processing');--> statement-breakpoint
CREATE TYPE "public"."dispute_status" AS ENUM('open', 'investigating', 'resolved', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."enrolment_status" AS ENUM('interested', 'submitted', 'enrolled', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."federation_level" AS ENUM('national', 'state');--> statement-breakpoint
CREATE TYPE "public"."institution_type" AS ENUM('school', 'panchayat', 'hospital', 'office', 'other');--> statement-breakpoint
CREATE TYPE "public"."ledger_direction" AS ENUM('credit', 'debit');--> statement-breakpoint
CREATE TYPE "public"."ledger_kind" AS ENUM('wage', 'welfare', 'platform_fee', 'gst', 'cash_offset', 'payout', 'adjustment');--> statement-breakpoint
CREATE TYPE "public"."offer_channel" AS ENUM('app', 'sms', 'ivr');--> statement-breakpoint
CREATE TYPE "public"."offer_response" AS ENUM('accepted', 'declined', 'timeout', 'superseded');--> statement-breakpoint
CREATE TYPE "public"."payment_method" AS ENUM('upi', 'cash');--> statement-breakpoint
CREATE TYPE "public"."payment_status" AS ENUM('created', 'captured', 'failed', 'refunded');--> statement-breakpoint
CREATE TYPE "public"."rating_channel" AS ENUM('app', 'voice');--> statement-breakpoint
CREATE TYPE "public"."relief_rate_mode" AS ENUM('normal', 'no_surcharge');--> statement-breakpoint
CREATE TYPE "public"."sentiment" AS ENUM('positive', 'neutral', 'negative');--> statement-breakpoint
CREATE TYPE "public"."skill_source" AS ENUM('roster', 'voice_interview', 'certificate', 'admin');--> statement-breakpoint
CREATE TYPE "public"."urgency" AS ENUM('normal', 'emergency');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('customer', 'worker', 'lcs_admin', 'state_admin', 'national_admin', 'institution_admin');--> statement-breakpoint
CREATE TYPE "public"."worker_status" AS ENUM('pending', 'verified', 'suspended');--> statement-breakpoint
CREATE TABLE "pincodes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pincode" text NOT NULL,
	"office_name" text NOT NULL,
	"district" text NOT NULL,
	"state_name" text NOT NULL,
	"location" geometry(Point,4326) NOT NULL,
	CONSTRAINT "pincodes_pincode_format" CHECK ("pincodes"."pincode" ~ '^[1-9][0-9]{5}$')
);
--> statement-breakpoint
CREATE TABLE "state_config" (
	"state_code" text PRIMARY KEY NOT NULL,
	"welfare_pct" numeric(5, 2) NOT NULL,
	"platform_fee_pct" numeric(5, 2) NOT NULL,
	"gst_pct_on_platform_fee" numeric(5, 2) NOT NULL,
	"default_locale" text NOT NULL,
	"locales" text[] NOT NULL,
	"timezone" text NOT NULL,
	"is_placeholder" boolean DEFAULT true NOT NULL,
	CONSTRAINT "state_config_pct_range" CHECK ("state_config"."welfare_pct" BETWEEN 0 AND 100 AND "state_config"."platform_fee_pct" BETWEEN 0 AND 100
          AND "state_config"."gst_pct_on_platform_fee" BETWEEN 0 AND 100),
	CONSTRAINT "state_config_default_locale_listed" CHECK ("state_config"."default_locale" = ANY ("state_config"."locales"))
);
--> statement-breakpoint
CREATE TABLE "state_trade_rates" (
	"state_code" text NOT NULL,
	"trade_code" text NOT NULL,
	"wage_floor_per_hour_paise" bigint NOT NULL,
	"min_billable_minutes" integer NOT NULL,
	"visit_charge_paise" bigint NOT NULL,
	"emergency_surcharge_pct" numeric(5, 2) NOT NULL,
	"is_placeholder" boolean DEFAULT true NOT NULL,
	CONSTRAINT "state_trade_rates_state_code_trade_code_pk" PRIMARY KEY("state_code","trade_code"),
	CONSTRAINT "state_trade_rates_non_negative" CHECK ("state_trade_rates"."wage_floor_per_hour_paise" > 0 AND "state_trade_rates"."min_billable_minutes" > 0
          AND "state_trade_rates"."visit_charge_paise" >= 0 AND "state_trade_rates"."emergency_surcharge_pct" BETWEEN 0 AND 100)
);
--> statement-breakpoint
CREATE TABLE "states" (
	"code" text PRIMARY KEY NOT NULL,
	"name_key" text NOT NULL,
	"active" boolean DEFAULT false NOT NULL,
	CONSTRAINT "states_code_format" CHECK ("states"."code" ~ '^[A-Z]{2}$')
);
--> statement-breakpoint
CREATE TABLE "trades" (
	"code" text PRIMARY KEY NOT NULL,
	"certified_required" boolean DEFAULT false NOT NULL,
	"icon" text NOT NULL,
	"sort_order" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "federations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"state_code" text,
	"name" text NOT NULL,
	"level" "federation_level" NOT NULL,
	"parent_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "federations_level_state" CHECK (("federations"."level" = 'national' AND "federations"."state_code" IS NULL)
          OR ("federations"."level" = 'state' AND "federations"."state_code" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "societies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"federation_id" uuid NOT NULL,
	"state_code" text NOT NULL,
	"name" text NOT NULL,
	"district" text NOT NULL,
	"reg_no" text,
	"location" geometry(Point,4326) NOT NULL,
	"is_demo" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "institutions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"type" "institution_type" NOT NULL,
	"gstin" text,
	"state_code" text NOT NULL,
	"address_text" text NOT NULL,
	"location" geometry(Point,4326) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "addresses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"label" text,
	"address_text" text NOT NULL,
	"pincode" text NOT NULL,
	"location" geometry(Point,4326) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "consents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"purpose" "consent_purpose" NOT NULL,
	"version" text NOT NULL,
	"channel" "consent_channel" NOT NULL,
	"accepted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"evidence" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"phone" text NOT NULL,
	"name" text,
	"role" "user_role" NOT NULL,
	"locale" text,
	"state_code" text,
	"society_id" uuid,
	"institution_id" uuid,
	"session_version" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_login_at" timestamp with time zone,
	CONSTRAINT "users_phone_unique" UNIQUE("phone"),
	CONSTRAINT "users_phone_e164" CHECK ("users"."phone" ~ '^\+[1-9][0-9]{7,14}$')
);
--> statement-breakpoint
CREATE TABLE "worker_skills" (
	"worker_id" uuid NOT NULL,
	"trade_code" text NOT NULL,
	"level" smallint NOT NULL,
	"years" integer DEFAULT 0 NOT NULL,
	"certified" boolean DEFAULT false NOT NULL,
	"source" "skill_source" NOT NULL,
	"verified" boolean DEFAULT false NOT NULL,
	CONSTRAINT "worker_skills_worker_id_trade_code_pk" PRIMARY KEY("worker_id","trade_code"),
	CONSTRAINT "worker_skills_level_range" CHECK ("worker_skills"."level" BETWEEN 1 AND 3),
	CONSTRAINT "worker_skills_years_non_negative" CHECK ("worker_skills"."years" >= 0)
);
--> statement-breakpoint
CREATE TABLE "workers" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"society_id" uuid NOT NULL,
	"status" "worker_status" DEFAULT 'pending' NOT NULL,
	"service_radius_km" numeric(4, 1) DEFAULT '8' NOT NULL,
	"home_location" geometry(Point,4326) NOT NULL,
	"available" boolean DEFAULT false NOT NULL,
	"available_updated_at" timestamp with time zone,
	"has_smartphone" boolean DEFAULT false NOT NULL,
	"rating_sum" integer DEFAULT 0 NOT NULL,
	"rating_count" integer DEFAULT 0 NOT NULL,
	"last_job_completed_at" timestamp with time zone,
	"eshram_uan" text,
	"qr_key_version" integer DEFAULT 1 NOT NULL,
	"photo_url" text,
	"verified_by" uuid,
	"verified_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "workers_service_radius_positive" CHECK ("workers"."service_radius_km" > 0),
	CONSTRAINT "workers_rating_consistent" CHECK ("workers"."rating_count" >= 0 AND "workers"."rating_sum" BETWEEN "workers"."rating_count" AND 5 * "workers"."rating_count")
);
--> statement-breakpoint
CREATE TABLE "demand_forecasts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"state_code" text NOT NULL,
	"h3_cell" text NOT NULL,
	"trade_code" text NOT NULL,
	"date" date NOT NULL,
	"predicted" numeric NOT NULL,
	"lower" numeric NOT NULL,
	"upper" numeric NOT NULL,
	"model_version" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "demand_forecasts_cell_trade_date_model_unique" UNIQUE("h3_cell","trade_code","date","model_version"),
	CONSTRAINT "demand_forecasts_interval" CHECK ("demand_forecasts"."lower" <= "demand_forecasts"."predicted" AND "demand_forecasts"."predicted" <= "demand_forecasts"."upper")
);
--> statement-breakpoint
CREATE TABLE "disaster_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"state_code" text NOT NULL,
	"districts" text[] NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"relief_rate_mode" "relief_rate_mode" DEFAULT 'normal' NOT NULL,
	"started_by" uuid NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ended_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "festivals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"state_code" text NOT NULL,
	"name_key" text NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"is_placeholder" boolean DEFAULT true NOT NULL,
	CONSTRAINT "festivals_state_name_start_unique" UNIQUE("state_code","name_key","start_date"),
	CONSTRAINT "festivals_date_order" CHECK ("festivals"."end_date" >= "festivals"."start_date")
);
--> statement-breakpoint
CREATE TABLE "booking_events" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"booking_id" uuid NOT NULL,
	"actor_user_id" uuid,
	"actor_system" text,
	"from_status" "booking_status",
	"to_status" "booking_status" NOT NULL,
	"meta" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "booking_events_has_actor" CHECK ("booking_events"."actor_user_id" IS NOT NULL OR "booking_events"."actor_system" IS NOT NULL)
);
--> statement-breakpoint
CREATE TABLE "booking_offers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"booking_id" uuid NOT NULL,
	"worker_id" uuid NOT NULL,
	"rank" smallint NOT NULL,
	"channel" "offer_channel" NOT NULL,
	"score" numeric(6, 4) NOT NULL,
	"breakdown" jsonb NOT NULL,
	"explanation_key" text NOT NULL,
	"explanation_params" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"offered_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"responded_at" timestamp with time zone,
	"response" "offer_response",
	CONSTRAINT "booking_offers_rank_positive" CHECK ("booking_offers"."rank" >= 1)
);
--> statement-breakpoint
CREATE TABLE "bookings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_id" uuid NOT NULL,
	"institution_id" uuid,
	"state_code" text NOT NULL,
	"society_id" uuid,
	"worker_id" uuid,
	"trade_code" text NOT NULL,
	"problem_text" text NOT NULL,
	"problem_summary_en" text,
	"source" "booking_source" NOT NULL,
	"urgency" "urgency" DEFAULT 'normal' NOT NULL,
	"disaster_event_id" uuid,
	"scheduled_for" timestamp with time zone,
	"estimated_minutes" integer NOT NULL,
	"location" geometry(Point,4326) NOT NULL,
	"address_text" text NOT NULL,
	"pincode" text NOT NULL,
	"status" "booking_status" DEFAULT 'requested' NOT NULL,
	"quote" jsonb NOT NULL,
	"wage_paise" bigint NOT NULL,
	"welfare_paise" bigint NOT NULL,
	"platform_fee_paise" bigint NOT NULL,
	"gst_paise" bigint DEFAULT 0 NOT NULL,
	"total_paise" bigint NOT NULL,
	"start_otp_hash" text,
	"complete_otp_hash" text,
	"start_otp_attempts" smallint DEFAULT 0 NOT NULL,
	"complete_otp_attempts" smallint DEFAULT 0 NOT NULL,
	"otp_locked_at" timestamp with time zone,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"cancelled_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "bookings_estimated_minutes_positive" CHECK ("bookings"."estimated_minutes" > 0),
	CONSTRAINT "bookings_money_non_negative" CHECK ("bookings"."wage_paise" >= 0 AND "bookings"."welfare_paise" >= 0 AND "bookings"."platform_fee_paise" >= 0
          AND "bookings"."gst_paise" >= 0),
	CONSTRAINT "bookings_total_is_sum" CHECK ("bookings"."total_paise" = "bookings"."wage_paise" + "bookings"."welfare_paise" + "bookings"."platform_fee_paise" + "bookings"."gst_paise"),
	CONSTRAINT "bookings_otp_attempts_range" CHECK ("bookings"."start_otp_attempts" BETWEEN 0 AND 5 AND "bookings"."complete_otp_attempts" BETWEEN 0 AND 5)
);
--> statement-breakpoint
CREATE TABLE "disputes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"booking_id" uuid NOT NULL,
	"raised_by" uuid NOT NULL,
	"reason_code" text NOT NULL,
	"description" text,
	"status" "dispute_status" DEFAULT 'open' NOT NULL,
	"resolution_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "ratings" (
	"booking_id" uuid PRIMARY KEY NOT NULL,
	"stars" smallint NOT NULL,
	"comment_text" text,
	"channel" "rating_channel" NOT NULL,
	"sentiment" "sentiment",
	"flags" text[] DEFAULT '{}'::text[] NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ratings_stars_range" CHECK ("ratings"."stars" BETWEEN 1 AND 5)
);
--> statement-breakpoint
CREATE TABLE "idempotency_keys" (
	"key" text PRIMARY KEY NOT NULL,
	"scope" text NOT NULL,
	"response" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invoice_sequences" (
	"society_id" uuid NOT NULL,
	"fiscal_year" text NOT NULL,
	"last_number" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "invoice_sequences_society_id_fiscal_year_pk" PRIMARY KEY("society_id","fiscal_year"),
	CONSTRAINT "invoice_sequences_non_negative" CHECK ("invoice_sequences"."last_number" >= 0)
);
--> statement-breakpoint
CREATE TABLE "invoices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"booking_id" uuid,
	"institution_id" uuid,
	"society_id" uuid NOT NULL,
	"number" text NOT NULL,
	"fiscal_year" text NOT NULL,
	"lines" jsonb NOT NULL,
	"totals" jsonb NOT NULL,
	"pdf_path" text,
	"issued_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "invoices_number_unique" UNIQUE("number")
);
--> statement-breakpoint
CREATE TABLE "ledger_entries" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"account" text NOT NULL,
	"booking_id" uuid,
	"amount_paise" bigint NOT NULL,
	"direction" "ledger_direction" NOT NULL,
	"kind" "ledger_kind" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"prev_hash" text NOT NULL,
	"hash" text NOT NULL,
	CONSTRAINT "ledger_entries_hash_unique" UNIQUE("hash"),
	CONSTRAINT "ledger_entries_amount_positive" CHECK ("ledger_entries"."amount_paise" > 0),
	CONSTRAINT "ledger_entries_hash_format" CHECK ("ledger_entries"."hash" ~ '^[0-9a-f]{64}$' AND "ledger_entries"."prev_hash" ~ '^[0-9a-f]{64}$')
);
--> statement-breakpoint
CREATE TABLE "ledger_head" (
	"id" smallint PRIMARY KEY NOT NULL,
	"last_hash" text NOT NULL,
	CONSTRAINT "ledger_head_singleton" CHECK ("ledger_head"."id" = 1),
	CONSTRAINT "ledger_head_hash_format" CHECK ("ledger_head"."last_hash" ~ '^[0-9a-f]{64}$')
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"booking_id" uuid NOT NULL,
	"method" "payment_method" NOT NULL,
	"amount_paise" bigint NOT NULL,
	"status" "payment_status" DEFAULT 'created' NOT NULL,
	"provider_order_id" text,
	"provider_payment_id" text,
	"idempotency_key" text NOT NULL,
	"raw" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payments_idempotency_key_unique" UNIQUE("idempotency_key"),
	CONSTRAINT "payments_amount_positive" CHECK ("payments"."amount_paise" > 0)
);
--> statement-breakpoint
CREATE TABLE "welfare_enrolments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"worker_id" uuid NOT NULL,
	"scheme_code" text NOT NULL,
	"status" "enrolment_status" DEFAULT 'interested' NOT NULL,
	"reference" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "welfare_enrolments_worker_scheme_unique" UNIQUE("worker_id","scheme_code")
);
--> statement-breakpoint
CREATE TABLE "welfare_schemes" (
	"code" text PRIMARY KEY NOT NULL,
	"state_code" text,
	"name_key" text NOT NULL,
	"rules" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"is_placeholder" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "call_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"call_sid" text NOT NULL,
	"direction" "call_direction" NOT NULL,
	"purpose" "call_purpose" NOT NULL,
	"phone" text NOT NULL,
	"user_id" uuid,
	"locale" text,
	"state" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"transcript" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"outcome" text,
	"booking_id" uuid,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ended_at" timestamp with time zone,
	CONSTRAINT "call_sessions_call_sid_unique" UNIQUE("call_sid")
);
--> statement-breakpoint
ALTER TABLE "state_config" ADD CONSTRAINT "state_config_state_code_states_code_fk" FOREIGN KEY ("state_code") REFERENCES "public"."states"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "state_trade_rates" ADD CONSTRAINT "state_trade_rates_state_code_states_code_fk" FOREIGN KEY ("state_code") REFERENCES "public"."states"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "state_trade_rates" ADD CONSTRAINT "state_trade_rates_trade_code_trades_code_fk" FOREIGN KEY ("trade_code") REFERENCES "public"."trades"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "federations" ADD CONSTRAINT "federations_state_code_states_code_fk" FOREIGN KEY ("state_code") REFERENCES "public"."states"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "federations" ADD CONSTRAINT "federations_parent_id_federations_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."federations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "societies" ADD CONSTRAINT "societies_federation_id_federations_id_fk" FOREIGN KEY ("federation_id") REFERENCES "public"."federations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "societies" ADD CONSTRAINT "societies_state_code_states_code_fk" FOREIGN KEY ("state_code") REFERENCES "public"."states"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "institutions" ADD CONSTRAINT "institutions_state_code_states_code_fk" FOREIGN KEY ("state_code") REFERENCES "public"."states"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "addresses" ADD CONSTRAINT "addresses_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consents" ADD CONSTRAINT "consents_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_state_code_states_code_fk" FOREIGN KEY ("state_code") REFERENCES "public"."states"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_society_id_societies_id_fk" FOREIGN KEY ("society_id") REFERENCES "public"."societies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_institution_id_institutions_id_fk" FOREIGN KEY ("institution_id") REFERENCES "public"."institutions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "worker_skills" ADD CONSTRAINT "worker_skills_worker_id_workers_user_id_fk" FOREIGN KEY ("worker_id") REFERENCES "public"."workers"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "worker_skills" ADD CONSTRAINT "worker_skills_trade_code_trades_code_fk" FOREIGN KEY ("trade_code") REFERENCES "public"."trades"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workers" ADD CONSTRAINT "workers_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workers" ADD CONSTRAINT "workers_society_id_societies_id_fk" FOREIGN KEY ("society_id") REFERENCES "public"."societies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workers" ADD CONSTRAINT "workers_verified_by_users_id_fk" FOREIGN KEY ("verified_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "demand_forecasts" ADD CONSTRAINT "demand_forecasts_state_code_states_code_fk" FOREIGN KEY ("state_code") REFERENCES "public"."states"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "demand_forecasts" ADD CONSTRAINT "demand_forecasts_trade_code_trades_code_fk" FOREIGN KEY ("trade_code") REFERENCES "public"."trades"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "disaster_events" ADD CONSTRAINT "disaster_events_state_code_states_code_fk" FOREIGN KEY ("state_code") REFERENCES "public"."states"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "disaster_events" ADD CONSTRAINT "disaster_events_started_by_users_id_fk" FOREIGN KEY ("started_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "festivals" ADD CONSTRAINT "festivals_state_code_states_code_fk" FOREIGN KEY ("state_code") REFERENCES "public"."states"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_events" ADD CONSTRAINT "booking_events_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_events" ADD CONSTRAINT "booking_events_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_offers" ADD CONSTRAINT "booking_offers_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_offers" ADD CONSTRAINT "booking_offers_worker_id_workers_user_id_fk" FOREIGN KEY ("worker_id") REFERENCES "public"."workers"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_customer_id_users_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_institution_id_institutions_id_fk" FOREIGN KEY ("institution_id") REFERENCES "public"."institutions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_state_code_states_code_fk" FOREIGN KEY ("state_code") REFERENCES "public"."states"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_society_id_societies_id_fk" FOREIGN KEY ("society_id") REFERENCES "public"."societies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_worker_id_workers_user_id_fk" FOREIGN KEY ("worker_id") REFERENCES "public"."workers"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_trade_code_trades_code_fk" FOREIGN KEY ("trade_code") REFERENCES "public"."trades"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_disaster_event_id_disaster_events_id_fk" FOREIGN KEY ("disaster_event_id") REFERENCES "public"."disaster_events"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_raised_by_users_id_fk" FOREIGN KEY ("raised_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ratings" ADD CONSTRAINT "ratings_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_sequences" ADD CONSTRAINT "invoice_sequences_society_id_societies_id_fk" FOREIGN KEY ("society_id") REFERENCES "public"."societies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_institution_id_institutions_id_fk" FOREIGN KEY ("institution_id") REFERENCES "public"."institutions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_society_id_societies_id_fk" FOREIGN KEY ("society_id") REFERENCES "public"."societies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "welfare_enrolments" ADD CONSTRAINT "welfare_enrolments_worker_id_workers_user_id_fk" FOREIGN KEY ("worker_id") REFERENCES "public"."workers"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "welfare_enrolments" ADD CONSTRAINT "welfare_enrolments_scheme_code_welfare_schemes_code_fk" FOREIGN KEY ("scheme_code") REFERENCES "public"."welfare_schemes"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "welfare_schemes" ADD CONSTRAINT "welfare_schemes_state_code_states_code_fk" FOREIGN KEY ("state_code") REFERENCES "public"."states"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "call_sessions" ADD CONSTRAINT "call_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "call_sessions" ADD CONSTRAINT "call_sessions_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "pincodes_pincode_idx" ON "pincodes" USING btree ("pincode");--> statement-breakpoint
CREATE INDEX "pincodes_district_idx" ON "pincodes" USING btree ("state_name","district");--> statement-breakpoint
CREATE INDEX "pincodes_location_gist" ON "pincodes" USING gist ("location");--> statement-breakpoint
CREATE INDEX "societies_state_idx" ON "societies" USING btree ("state_code");--> statement-breakpoint
CREATE INDEX "societies_location_gist" ON "societies" USING gist ("location");--> statement-breakpoint
CREATE INDEX "institutions_location_gist" ON "institutions" USING gist ("location");--> statement-breakpoint
CREATE INDEX "addresses_user_idx" ON "addresses" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "addresses_location_gist" ON "addresses" USING gist ("location");--> statement-breakpoint
CREATE INDEX "consents_user_purpose_idx" ON "consents" USING btree ("user_id","purpose");--> statement-breakpoint
CREATE INDEX "users_society_idx" ON "users" USING btree ("society_id");--> statement-breakpoint
CREATE INDEX "users_role_idx" ON "users" USING btree ("role");--> statement-breakpoint
CREATE INDEX "worker_skills_trade_idx" ON "worker_skills" USING btree ("trade_code");--> statement-breakpoint
CREATE INDEX "workers_society_status_available_idx" ON "workers" USING btree ("society_id","status","available");--> statement-breakpoint
CREATE INDEX "workers_home_location_gist" ON "workers" USING gist ("home_location");--> statement-breakpoint
CREATE INDEX "disaster_events_state_active_idx" ON "disaster_events" USING btree ("state_code","active");--> statement-breakpoint
CREATE INDEX "booking_events_booking_idx" ON "booking_events" USING btree ("booking_id","at");--> statement-breakpoint
CREATE INDEX "booking_offers_booking_idx" ON "booking_offers" USING btree ("booking_id");--> statement-breakpoint
CREATE INDEX "booking_offers_worker_idx" ON "booking_offers" USING btree ("worker_id","response");--> statement-breakpoint
CREATE INDEX "bookings_status_idx" ON "bookings" USING btree ("status");--> statement-breakpoint
CREATE INDEX "bookings_society_created_idx" ON "bookings" USING btree ("society_id","created_at");--> statement-breakpoint
CREATE INDEX "bookings_worker_status_idx" ON "bookings" USING btree ("worker_id","status");--> statement-breakpoint
CREATE INDEX "bookings_customer_idx" ON "bookings" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "bookings_location_gist" ON "bookings" USING gist ("location");--> statement-breakpoint
CREATE INDEX "disputes_booking_idx" ON "disputes" USING btree ("booking_id");--> statement-breakpoint
CREATE INDEX "disputes_status_idx" ON "disputes" USING btree ("status");--> statement-breakpoint
CREATE INDEX "invoices_society_idx" ON "invoices" USING btree ("society_id","fiscal_year");--> statement-breakpoint
CREATE INDEX "invoices_institution_idx" ON "invoices" USING btree ("institution_id");--> statement-breakpoint
CREATE INDEX "ledger_entries_account_idx" ON "ledger_entries" USING btree ("account");--> statement-breakpoint
CREATE INDEX "ledger_entries_booking_idx" ON "ledger_entries" USING btree ("booking_id");--> statement-breakpoint
CREATE INDEX "payments_booking_idx" ON "payments" USING btree ("booking_id");--> statement-breakpoint
CREATE INDEX "call_sessions_phone_idx" ON "call_sessions" USING btree ("phone");