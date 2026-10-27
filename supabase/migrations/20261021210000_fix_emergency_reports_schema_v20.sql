-- Migration: 20261021210000_fix_emergency_reports_schema_v20.sql
BEGIN;

-- 1. Ensure Enums
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'report_status') THEN CREATE TYPE public.report_status AS ENUM ('pending', 'assigned', 'in-progress', 'resolved', 'declined'); END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'priority_level') THEN CREATE TYPE public.priority_level AS ENUM ('low', 'medium', 'high', 'critical'); END IF;
END $$;

-- 2. Add columns if missing (as text first)
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'emergency_reports' AND column_name = 'status') THEN ALTER TABLE public.emergency_reports ADD COLUMN status TEXT; END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'emergency_reports' AND column_name = 'priority') THEN ALTER TABLE public.emergency_reports ADD COLUMN priority TEXT; END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'emergency_reports' AND column_name = 'report_id') THEN ALTER TABLE public.emergency_reports ADD COLUMN report_id TEXT; END IF;
END $$;

-- 3. Validation: Reject invalid data (Check attachments JSONB)
DO $$
DECLARE
    invalid_status TEXT;
BEGIN
    SELECT attachments->>'status' INTO invalid_status FROM public.emergency_reports 
    WHERE attachments->>'status' IS NOT NULL 
    AND (attachments->>'status') NOT IN ('pending', 'assigned', 'in-progress', 'resolved', 'declined') LIMIT 1;
    IF invalid_status IS NOT NULL THEN RAISE EXCEPTION 'Invalid status: %', invalid_status; END IF;
END $$;

-- 4. Backfill data
UPDATE public.emergency_reports SET
    status = COALESCE(status::text, attachments->>'status', 'pending')::public.report_status,
    priority = COALESCE(priority::text, attachments->>'priority', 'low')::public.priority_level;

-- 5. Convert to Enums
ALTER TABLE public.emergency_reports 
    ALTER COLUMN status TYPE public.report_status USING status::public.report_status,
    ALTER COLUMN priority TYPE public.priority_level USING priority::public.priority_level;

-- 6. Sequence & Backfill
CREATE SEQUENCE IF NOT EXISTS public.report_id_seq START 1001;
LOCK TABLE public.emergency_reports IN SHARE ROW EXCLUSIVE MODE;
DO $$ DECLARE max_id INT; seq_val BIGINT; BEGIN
    SELECT COALESCE(MAX(substring(report_id FROM 5)::INT), 1000) INTO max_id FROM public.emergency_reports WHERE report_id ~ '^RPT-[0-9]+$';
    SELECT last_value INTO seq_val FROM public.report_id_seq;
    IF seq_val <= max_id THEN PERFORM setval('public.report_id_seq', max_id + 1, false); END IF;
END $$;
UPDATE public.emergency_reports SET report_id = 'RPT-' || nextval('public.report_id_seq') WHERE report_id IS NULL OR report_id = '';

-- 7. Constraints & Trigger
ALTER TABLE public.emergency_reports ALTER COLUMN status SET DEFAULT 'pending';
ALTER TABLE public.emergency_reports ALTER COLUMN status SET NOT NULL;
ALTER TABLE public.emergency_reports ALTER COLUMN priority SET NOT NULL;
ALTER TABLE public.emergency_reports ALTER COLUMN report_id SET NOT NULL;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'emergency_reports_report_id_key') THEN ALTER TABLE public.emergency_reports ADD CONSTRAINT emergency_reports_report_id_key UNIQUE (report_id); END IF; END $$;

CREATE OR REPLACE FUNCTION public.set_default_report_id() RETURNS TRIGGER AS $$ BEGIN
    IF NEW.report_id IS NULL OR NEW.report_id = '' THEN NEW.report_id := 'RPT-' || nextval('public.report_id_seq'); END IF;
    RETURN NEW;
END; $$ LANGUAGE plpgsql SECURITY INVOKER;
DROP TRIGGER IF EXISTS trg_set_report_id ON public.emergency_reports;
CREATE TRIGGER trg_set_report_id BEFORE INSERT ON public.emergency_reports FOR EACH ROW EXECUTE FUNCTION public.set_default_report_id();

COMMIT;
