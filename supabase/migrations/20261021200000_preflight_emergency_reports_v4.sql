-- Revised Preflight: Robust, non-sampling validation
-- Identifies state of emergency_reports before migration.

DO $$
DECLARE
    status_exists BOOLEAN;
    report_id_exists BOOLEAN;
    enum_exists BOOLEAN;
    duplicates_found INT;
    invalid_json_statuses INT;
    total_rows INT;
BEGIN
    SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'emergency_reports' AND column_name = 'status') INTO status_exists;
    SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'emergency_reports' AND column_name = 'report_id') INTO report_id_exists;
    SELECT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'report_status') INTO enum_exists;
    SELECT count(*) INTO total_rows FROM public.emergency_reports;

    RAISE NOTICE '--- Preflight Report ---';
    RAISE NOTICE 'Total Rows: %', total_rows;
    RAISE NOTICE 'Column [status] exists: %', status_exists;
    RAISE NOTICE 'Column [report_id] exists: %', report_id_exists;
    RAISE NOTICE 'Enum [report_status] exists: %', enum_exists;

    IF report_id_exists THEN
        SELECT count(*) INTO duplicates_found FROM (SELECT report_id, count(*) FROM public.emergency_reports WHERE report_id IS NOT NULL GROUP BY report_id HAVING count(*) > 1) AS d;
        RAISE NOTICE 'Duplicate report_ids: %', duplicates_found;
        RAISE NOTICE 'NULL/Blank report_ids: %', (SELECT count(*) FROM public.emergency_reports WHERE report_id IS NULL OR report_id = '');
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'emergency_reports' AND column_name = 'attachments') THEN
        -- Check for status values in JSON that are not valid enum labels
        SELECT count(*) INTO invalid_json_statuses 
        FROM public.emergency_reports 
        WHERE attachments->>'status' IS NOT NULL 
          AND (attachments->>'status') NOT IN ('pending', 'assigned', 'in-progress', 'resolved', 'declined');
        RAISE NOTICE 'Invalid/unmapped JSON status values: %', invalid_json_statuses;
    END IF;
END $$;
