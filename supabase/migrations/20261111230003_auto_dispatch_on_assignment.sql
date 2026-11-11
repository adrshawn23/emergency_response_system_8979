-- Auto-dispatch on assignment + reporter name on the public feed.
--
-- Two gaps seen on live data (RPT-1458 vs RPT-1459, both fire->Fire dept):
--
-- 1) trg_auto_dispatch_assistance is AFTER INSERT only. Reports whose
--    assigned_department_id is NULL at filing and set later by dispatch
--    never get cross-department requests — and the function's
--    reassignment-cancel branch is dead code. Add a column-scoped UPDATE
--    trigger so assigning/reassigning a department creates (or cancels
--    and recreates) the auto-dispatch requests.
--
-- 2) public_incidents strips reporter identity entirely. The barangay
--    wants "Reported by <name>" on the public detail modal — name only;
--    contact_phone stays behind emergency_reports RLS.
--
-- Apply via Supabase SQL editor.

BEGIN;

-- 1. Fire auto-dispatch when a department is assigned after filing -------
--    AFTER UPDATE OF ... only fires when the column is actually set, and
--    the WHEN guard skips no-op writes. The existing function already
--    handles TG_OP='UPDATE' (cancels stale pending auto-dispatch rows to
--    the old department before inserting the new set).
DROP TRIGGER IF EXISTS trg_auto_dispatch_assistance_update ON public.emergency_reports;
CREATE TRIGGER trg_auto_dispatch_assistance_update
    AFTER UPDATE OF assigned_department_id ON public.emergency_reports
    FOR EACH ROW
    WHEN (OLD.assigned_department_id IS DISTINCT FROM NEW.assigned_department_id)
    EXECUTE FUNCTION public.auto_dispatch_assistance();

-- 2. Reporter display name on the public feed ----------------------------
CREATE OR REPLACE VIEW public.public_incidents AS
SELECT
    er.id,
    er.report_id,
    er.report_type,
    er.content,
    er.status,
    er.priority,
    er.created_at,
    er.resolved_at,
    er.reporter_id,
    er.assigned_department_id,
    jsonb_build_object(
        'location',            er.attachments->>'location',
        'latitude',            er.attachments->>'latitude',
        'longitude',           er.attachments->>'longitude',
        'service_area_status', er.attachments->>'service_area_status'
    ) AS attachments,
    up.full_name AS reporter_name
FROM public.emergency_reports er
LEFT JOIN public.user_profiles up ON up.id = er.reporter_id;

GRANT SELECT ON public.public_incidents TO authenticated;

COMMIT;
