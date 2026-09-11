ALTER TABLE "users" ALTER COLUMN "role" SET DATA TYPE text;--> statement-breakpoint
UPDATE "users" SET "role" = 'user' WHERE "role" = 'customer';--> statement-breakpoint
UPDATE "users" SET "role" = 'corporate' WHERE "role" IN ('lcs_admin', 'state_admin', 'national_admin', 'institution_admin');--> statement-breakpoint
DROP TYPE "public"."user_role";--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('user', 'worker', 'corporate');--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "role" SET DATA TYPE "public"."user_role" USING "role"::"public"."user_role";
