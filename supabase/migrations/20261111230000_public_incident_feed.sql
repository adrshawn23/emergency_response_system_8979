-- Public incident feed — residents see every incident reported today,
-- not just their own ("situational awareness" board).
--
-- Problem: residents_view_own_reports restricts emergency_reports SELECT to
-- reporter_id = auth.uid(), so the live-incidents feed could only ever show
-- the viewer's own incidents.
--
-- public_incidents intentionally has NO security_invoker: the view runs as
-- its owner (postgres) and bypasses RLS, which is exactly what a public
-- feed needs. Reporter PII is stripped here — contact_name/contact_phone
-- never leave the table; the attachments payload is rebuilt keeping only
-- location, coordinates and the service-area verdict.
--
-- History + unit progress get permissive reads so the shared detail modal's
-- timeline ("Responding units") renders for non-reporters too. Both tables
-- hold operational progress data only (statuses, timestamps, names).
--
-- Apply via Supabase SQL editor.

BEGIN;

-- 1. Non-PII public feed ---------------------------------------------------
CREATE OR REPLACE VIEW public.public_incidents AS
SELECT
    id,
    report_id,
    report_type,
    content,
    status,
    priority,
    created_at,
    resolved_at,
    reporter_id,              -- needed so the app can tell "mine" from public
    assigned_department_id,
    jsonb_build_object(
        'location',            attachments->>'location',
        'latitude',            attachments->>'latitude',
        'longitude',           attachments->>'longitude',
        'service_area_status', attachments->>'service_area_status'
    ) AS attachments
FROM public.emergency_reports;

GRANT SELECT ON public.public_incidents TO authenticated;

-- 2. Tracking history — readable by any signed-in user ---------------------
DROP POLICY IF EXISTS "incident_history_public_read" ON public.incident_status_history;
CREATE POLICY "incident_history_public_read"
    ON public.incident_status_history
    FOR SELECT TO authenticated
    USING (true);

-- 3. Assisting-unit progress — readable by any signed-in user --------------
DROP POLICY IF EXISTS "cda_public_read" ON public.cross_department_assistance;
CREATE POLICY "cda_public_read"
    ON public.cross_department_assistance
    FOR SELECT TO authenticated
    USING (true);

COMMIT;
