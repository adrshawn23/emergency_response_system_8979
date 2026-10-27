-- Migration: 20261021210000_fix_emergency_reports_schema_v11.sql
BEGIN;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'report_status') THEN CREATE TYPE public.report_status AS ENUM ('pending', 'assigned', 'in-progress', 'resolved', 'declined'); END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'priority_level') THEN CREATE TYPE public.priority_level AS ENUM ('low', 'medium', 'high', 'critical'); END IF;
END $$;

ALTER TABLE public.emergency_reports 
    ADD COLUMN IF NOT EXISTS report_id TEXT,
    ADD COLUMN IF NOT EXISTS status public.report_status,
    ADD COLUMN IF NOT EXISTS priority public.priority_level;

DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM public.emergency_reports WHERE attachments->>'status' IS NOT NULL AND (attachments->>'status') NOT IN ('pending', 'assigned', 'in-progress', 'resolved', 'declined')) THEN 
        RAISE EXCEPTION 'Invalid status'; 
    END IF;
    IF EXISTS (SELECT 1 FROM public.emergency_reports WHERE attachments->>'priority' IS NOT NULL AND (attachments->>'priority') NOT IN ('low', 'medium', 'high', 'critical')) THEN 
        RAISE EXCEPTION 'Invalid priority'; 
    END IF;
END $$;

UPDATE public.emergency_reports SET
    status = COALESCE(status::text::public.report_status, (attachments->>'status')::public.report_status, 'pending'::public.report_status),
    priority = COALESCE(priority::text::priority_level, (attachments->>'priority')::public.priority_level)
WHERE status IS NULL OR priority IS NULL;

CREATE SEQUENCE IF NOT EXISTS public.report_id_seq START 1001;
DO $$ DECLARE max_id INT; BEGIN
    SELECT COALESCE(MAX(substring(report_id FROM 5)::INT), 1000) INTO max_id FROM public.emergency_reports WHERE report_id ~ '^RPT-[0-9]+$';
    PERFORM setval('public.report_id_seq', max_id + 1, false);
END $$;
UPDATE public.emergency_reports SET report_id = 'RPT-' || nextval('public.report_id_seq') WHERE report_id IS NULL OR report_id = '';

ALTER TABLE public.emergency_reports ALTER COLUMN status SET DEFAULT 'pending';
ALTER TABLE public.emergency_reports ALTER COLUMN status SET NOT NULL;
ALTER TABLE public.emergency_reports ALTER COLUMN report_id SET NOT NULL;

DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'emergency_reports_report_id_key') THEN ALTER TABLE public.emergency_reports ADD CONSTRAINT emergency_reports_report_id_key UNIQUE (report_id); END IF; END $$;

CREATE OR REPLACE FUNCTION public.set_default_report_id() RETURNS TRIGGER AS $$ BEGIN
    IF NEW.report_id IS NULL OR NEW.report_id = '' THEN NEW.report_id := 'RPT-' || nextval('public.report_id_seq'); END IF;
    RETURN NEW;
END; $$ LANGUAGE plpgsql SECURITY INVOKER;
DROP TRIGGER IF EXISTS trg_set_report_id ON public.emergency_reports;
CREATE TRIGGER trg_set_report_id BEFORE INSERT ON public.emergency_reports FOR EACH ROW EXECUTE FUNCTION public.set_default_report_id();

COMMIT;
