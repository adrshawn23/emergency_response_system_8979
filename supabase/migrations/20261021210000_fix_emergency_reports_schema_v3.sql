-- Revised Migration: Atomic, Concurrency-Safe Schema Repair
-- 1. Idempotent column/enum creation.
-- 2. Data migration from legacy JSONB to columns.
-- 3. Atomic backfill and constraint enforcement.

BEGIN;

-- 1. Ensure enum exists
CREATE TYPE public.report_status AS ENUM ('pending', 'assigned', 'in-progress', 'resolved', 'declined');
EXCEPTION WHEN duplicate_object THEN NULL;

-- 2. Add columns
ALTER TABLE public.emergency_reports 
ADD COLUMN IF NOT EXISTS report_id TEXT,
ADD COLUMN IF NOT EXISTS status public.report_status DEFAULT 'pending';

-- 3. Migration: Status from JSONB 'attachments'
-- Only migrate if status is currently NULL and attachments exist
UPDATE public.emergency_reports
SET status = (attachments->>'status')::public.report_status
WHERE status IS NULL 
  AND attachments ? 'status'
  AND (attachments->>'status') IN ('pending', 'assigned', 'in-progress', 'resolved', 'declined');

-- 4. Backfill and Constraint
-- Create a sequence for concurrency-safe report_id generation
CREATE SEQUENCE IF NOT EXISTS public.report_id_seq START 1001;

UPDATE public.emergency_reports
SET report_id = 'RPT-' || nextval('public.report_id_seq')
WHERE report_id IS NULL OR report_id = '';

-- 5. Enforce Constraints
ALTER TABLE public.emergency_reports 
ALTER COLUMN report_id SET NOT NULL,
ALTER COLUMN status SET NOT NULL;

-- Ensure uniqueness (Only add if not exists, though standard approach is drop/add in migration)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'emergency_reports_report_id_key') THEN
        ALTER TABLE public.emergency_reports ADD CONSTRAINT emergency_reports_report_id_key UNIQUE (report_id);
    END IF;
END $$;

-- 6. Future-proofing: Function to generate next ID
CREATE OR REPLACE FUNCTION public.generate_next_report_id()
RETURNS TEXT AS $$
BEGIN
    RETURN 'RPT-' || nextval('public.report_id_seq');
END;
$$ LANGUAGE plpgsql;

-- 7. Trigger for new inserts
CREATE OR REPLACE FUNCTION public.set_default_report_id()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.report_id IS NULL THEN
        NEW.report_id := public.generate_next_report_id();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_set_report_id ON public.emergency_reports;
CREATE TRIGGER trg_set_report_id
BEFORE INSERT ON public.emergency_reports
FOR EACH ROW EXECUTE FUNCTION public.set_default_report_id();

COMMIT;
