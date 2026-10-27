-- Preflight Checks: Verify schema and data before applying fix
-- Run this in Supabase SQL Editor to understand current state.

DO $$
BEGIN
    -- Check for columns
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'emergency_reports' AND column_name = 'status') THEN
        RAISE NOTICE 'Missing column: status';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'emergency_reports' AND column_name = 'report_id') THEN
        RAISE NOTICE 'Missing column: report_id';
    END IF;

    -- Check for enum
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'report_status') THEN
        RAISE NOTICE 'Missing enum: report_status';
    END IF;
    
    -- Check for orphaned status data (e.g., in a hypothetical JSONB 'attachments' column if it existed)
    -- This is a generic check.
END $$;

-- Summary query:
SELECT 
    (SELECT count(*) FROM public.emergency_reports WHERE status IS NULL) as reports_with_null_status,
    (SELECT count(*) FROM public.emergency_reports WHERE report_id IS NULL) as reports_with_null_report_id;
