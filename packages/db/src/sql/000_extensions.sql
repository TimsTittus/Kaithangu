-- PostGIS provides geometry(Point,4326) and ST_* functions. IF NOT EXISTS keeps
-- this a no-op where the extension is already installed (e.g. Supabase, which
-- installs extensions in its own "extensions" schema).
CREATE EXTENSION IF NOT EXISTS postgis;
--> statement-breakpoint
CREATE EXTENSION IF NOT EXISTS pgcrypto;
