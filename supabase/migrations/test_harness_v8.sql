-- test_harness_v8.sql
-- Executes actual migration file 20261021210000_fix_emergency_reports_schema_v8.sql in isolation.
BEGIN;

-- Setup: Create clean environment in public to match migration targets
DROP TABLE IF EXISTS public.emergency_reports CASCADE;
DROP TYPE IF EXISTS public.report_status;
DROP TYPE IF EXISTS public.priority_level;
DROP SEQUENCE IF EXISTS public.report_id_seq;

CREATE TYPE public.report_status AS ENUM ('pending', 'assigned', 'in-progress', 'resolved', 'declined');
CREATE TYPE public.priority_level AS ENUM ('low', 'medium', 'high', 'critical');
CREATE TABLE public.emergency_reports (id UUID DEFAULT gen_random_uuid(), report_id TEXT, attachments JSONB, status public.report_status, priority public.priority_level);

-- Test Role
DROP ROLE IF EXISTS test_app_user;
CREATE ROLE test_app_user LOGIN;
GRANT ALL ON SCHEMA public TO test_app_user;
GRANT ALL ON TABLE public.emergency_reports TO test_app_user;
-- Must grant access to the sequence that the migration will create
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO test_app_user;

-- Migration content (Inlined for harness execution)
\ir 20261021210000_fix_emergency_reports_schema_v8.sql

-- 1. Test: Invalid Data Rejection
INSERT INTO public.emergency_reports (attachments) VALUES ('{"status": "invalid"}');
DO $$ BEGIN 
    \ir 20261021210000_fix_emergency_reports_schema_v8.sql
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'Caught expected failure'; END $$;
TRUNCATE public.emergency_reports;

-- 2. Test: Backfill and Idempotency
INSERT INTO public.emergency_reports (attachments) VALUES ('{"status": "assigned", "priority": "high"}'), ('{"status": "pending"}');
\ir 20261021210000_fix_emergency_reports_schema_v8.sql
\ir 20261021210000_fix_emergency_reports_schema_v8.sql -- Rerun

-- 3. Test: Permissions
SET ROLE test_app_user;
INSERT INTO public.emergency_reports (attachments) VALUES ('{"status": "pending"}');
RESET ROLE;

-- 4. Assertions
DO $$ BEGIN
    IF (SELECT count(*) FROM public.emergency_reports WHERE report_id LIKE 'RPT-%') != 3 THEN RAISE EXCEPTION 'Backfill failed'; END IF;
    IF (SELECT count(*) FROM public.emergency_reports WHERE status = 'pending') != 2 THEN RAISE EXCEPTION 'Defaulting failed'; END IF;
    RAISE NOTICE 'SUCCESS: All tests passed.';
END $$;

ROLLBACK;
