-- Robust Migration: Fix emergency_reports schema and data
-- 1. Ensures required columns and enums exist.
-- 2. Migrates status from potential 'attachments' JSONB column.
-- 3. Backfills missing 'report_id'.
-- 4. Enforces NOT NULL and uniqueness.

BEGIN;

-- 1. Ensure report_status enum exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'report_status') THEN
        CREATE TYPE public.report_status AS ENUM ('pending', 'assigned', 'in-progress', 'resolved', 'declined');
    END IF;
END $$;

-- 2. Add columns if they don't exist
ALTER TABLE public.emergency_reports 
ADD COLUMN IF NOT EXISTS report_id TEXT,
ADD COLUMN IF NOT EXISTS status public.report_status;

-- 3. Data Migration: Migrate status from 'attachments' JSONB if it exists
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='emergency_reports' AND column_name='attachments') THEN
        UPDATE public.emergency_reports
        SET status = (attachments->>'status')::public.report_status
        WHERE status IS NULL 
          AND attachments->>'status' IS NOT NULL;
    END IF;
    
    -- Set default for remaining NULL statuses
    UPDATE public.emergency_reports 
    SET status = 'pending'::public.report_status 
    WHERE status IS NULL;
END $$;

-- 4. Backfill missing report_id with unique values
DO $$
DECLARE
    r RECORD;
    counter INT := 1001;
BEGIN
    -- Calculate starting counter (if any report_ids exist)
    SELECT MAX(substring(report_id FROM 5)::INT) + 1 INTO counter 
    FROM public.emergency_reports 
    WHERE report_id ~ '^RPT-[0-9]+$';
    
    IF counter IS NULL THEN counter := 1001; END IF;

    FOR r IN SELECT id FROM public.emergency_reports WHERE report_id IS NULL LOOP
        UPDATE public.emergency_reports 
        SET report_id = 'RPT-' || counter 
        WHERE id = r.id;
        counter := counter + 1;
    END LOOP;
END $$;

-- 5. Set Constraints
ALTER TABLE public.emergency_reports 
ALTER COLUMN report_id SET NOT NULL,
ALTER COLUMN status SET NOT NULL;

-- Ensure report_id is unique
-- If constraint fails, it means there are duplicate report_ids.
-- This might need a manual fix, but we'll try to add it.
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'emergency_reports_report_id_key') THEN
        ALTER TABLE public.emergency_reports ADD CONSTRAINT emergency_reports_report_id_key UNIQUE (report_id);
    END IF;
END $$;

COMMIT;
