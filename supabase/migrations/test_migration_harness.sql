-- Test Harness: Simulates broken schema and verifies V4 migration
-- This script validates the migration logic in a self-contained, reproducible way.

BEGIN;

-- 1. Setup Mock Schema
CREATE SCHEMA IF NOT EXISTS public;
DROP TABLE IF EXISTS public.emergency_reports;
DROP TYPE IF EXISTS public.report_status;
DROP TYPE IF EXISTS public.incident_type;
DROP TYPE IF EXISTS public.priority_level;

CREATE TYPE public.report_status AS ENUM ('pending', 'assigned', 'in-progress', 'resolved', 'declined');
CREATE TYPE public.incident_type AS ENUM ('fire', 'medical', 'police');
CREATE TYPE public.priority_level AS ENUM ('low', 'medium', 'high');

CREATE TABLE public.emergency_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    report_id TEXT,
    attachments JSONB,
    incident_type public.incident_type,
    priority public.priority_level
);

-- 2. Mock Data
INSERT INTO public.emergency_reports (report_id, attachments, incident_type, priority) VALUES
(NULL, '{"status": "assigned"}', 'fire', 'high'),      -- Needs status migration
('RPT-1005', '{"status": "resolved"}', 'medical', 'medium'), -- Has report_id, needs status migration
(NULL, '{}', 'police', 'low'),                        -- Needs status and report_id
('RPT-001', NULL, 'fire', 'critical');                -- Already has report_id, needs status (pending)

-- 3. THE MIGRATION (The code to be tested)
-- ... [This will be the content of the migration script] ...
-- [Inserted for testing...]

-- 4. Assertions
DO $$
BEGIN
    IF (SELECT count(*) FROM public.emergency_reports WHERE status = 'assigned') != 1 THEN RAISE EXCEPTION 'Migration failed: Status not migrated'; END IF;
    IF (SELECT count(*) FROM public.emergency_reports WHERE report_id = 'RPT-001') != 1 THEN RAISE EXCEPTION 'Migration failed: Existing ID corrupted'; END IF;
    IF (SELECT count(*) FROM public.emergency_reports WHERE report_id = 'RPT-1006') != 1 THEN RAISE EXCEPTION 'Migration failed: Sequence backfill failed'; END IF;
    RAISE NOTICE 'Migration successful!';
END $$;

ROLLBACK; -- Don't commit, it's just a test.
