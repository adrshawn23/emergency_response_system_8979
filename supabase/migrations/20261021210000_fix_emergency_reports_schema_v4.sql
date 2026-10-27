-- Robust Migration: Atomic, Concurrency-Safe Schema Repair (V4)

BEGIN;

-- 1. Ensure Enum exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'report_status') THEN
        CREATE TYPE public.report_status AS ENUM ('pending', 'assigned', 'in-progress', 'resolved', 'declined');
    END IF;
END $$;

-- 2. Add columns (Nullable initially)
ALTER TABLE public.emergency_reports 
ADD COLUMN IF NOT EXISTS report_id TEXT,
ADD COLUMN IF NOT EXISTS status public.report_status;

-- 3. Data Migration: Status from JSONB 'attachments'
-- Handle existing rows with JSONB status
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='emergency_reports' AND column_name='attachments') THEN
        UPDATE public.emergency_reports
        SET status = (attachments->>'status')::public.report_status
        WHERE status IS NULL 
          AND attachments ? 'status'
          AND (attachments->>'status') IN ('pending', 'assigned', 'in-progress', 'resolved', 'declined');
    END IF;
    
    -- Set default for remaining NULL statuses
    UPDATE public.emergency_reports 
    SET status = 'pending'::public.report_status 
    WHERE status IS NULL;
END $$;

-- 4. Backfill report_id with unique values
CREATE SEQUENCE IF NOT EXISTS public.report_id_seq START 1001;

DO $$
DECLARE
    max_id INT;
BEGIN
    -- Determine max existing ID to avoid collision
    SELECT COALESCE(MAX(substring(report_id FROM 5)::INT), 1000) INTO max_id
    FROM public.emergency_reports
    WHERE report_id ~ '^RPT-[0-9]+$';
    
    PERFORM setval('public.report_id_seq', max_id + 1, false);

    -- Backfill
    UPDATE public.emergency_reports
    SET report_id = 'RPT-' || nextval('public.report_id_seq')
    WHERE report_id IS NULL OR report_id = '';
END $$;

-- 5. Enforce Constraints and Defaults
ALTER TABLE public.emergency_reports 
ALTER COLUMN report_id SET NOT NULL,
ALTER COLUMN status SET DEFAULT 'pending',
ALTER COLUMN status SET NOT NULL;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'emergency_reports_report_id_key') THEN
        ALTER TABLE public.emergency_reports ADD CONSTRAINT emergency_reports_report_id_key UNIQUE (report_id);
    END IF;
END $$;

-- 6. Trigger for future inserts
CREATE OR REPLACE FUNCTION public.set_default_report_id()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.report_id IS NULL OR NEW.report_id = '' THEN
        NEW.report_id := 'RPT-' || nextval('public.report_id_seq');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_set_report_id ON public.emergency_reports;
CREATE TRIGGER trg_set_report_id
BEFORE INSERT ON public.emergency_reports
FOR EACH ROW EXECUTE FUNCTION public.set_default_report_id();

COMMIT;
