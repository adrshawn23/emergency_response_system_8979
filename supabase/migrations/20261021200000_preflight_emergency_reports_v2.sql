-- Revised Preflight Check: Robust validation for emergency_reports
-- Run this to identify issues before applying migration.

DO $$
DECLARE
    status_exists BOOLEAN;
    report_id_exists BOOLEAN;
    enum_exists BOOLEAN;
    duplicate_count INT;
BEGIN
    -- Check column existence
    SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'emergency_reports' AND column_name = 'status') INTO status_exists;
    SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'emergency_reports' AND column_name = 'report_id') INTO report_id_exists;
    
    -- Check enum existence
    SELECT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'report_status') INTO enum_exists;

    RAISE NOTICE '--- Preflight Report ---';
    RAISE NOTICE 'Column status exists: %', status_exists;
    RAISE NOTICE 'Column report_id exists: %', report_id_exists;
    RAISE NOTICE 'Enum report_status exists: %', enum_exists;

    -- Validate duplicate/blank report_ids if column exists
    IF report_id_exists THEN
        SELECT count(*) INTO duplicate_count FROM (SELECT report_id, count(*) FROM public.emergency_reports WHERE report_id IS NOT NULL GROUP BY report_id HAVING count(*) > 1) AS duplicates;
        RAISE NOTICE 'Duplicate report_ids found: %', duplicate_count;
        
        RAISE NOTICE 'Blank/NULL report_ids found: %', (SELECT count(*) FROM public.emergency_reports WHERE report_id IS NULL OR report_id = '');
    END IF;

    -- Validate legacy JSON statuses (if column exists)
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'emergency_reports' AND column_name = 'attachments') THEN
        RAISE NOTICE 'Legacy JSON status samples: %', (SELECT array_agg(attachments->>'status') FROM public.emergency_reports WHERE attachments ? 'status' LIMIT 5);
    END IF;
END $$;
