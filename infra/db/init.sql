-- Runs once, on first start of an empty data volume, against POSTGRES_DB.
-- Mounted as 20_init.sql so it runs after the image's own 10_postgis.sh.
-- Phase 1 creates extensions only; all tables come from drizzle-kit migrations.

CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE DATABASE kaithangu_test;

\connect kaithangu_test

CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pgcrypto;
