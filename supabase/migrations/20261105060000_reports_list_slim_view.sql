-- Slim list view for emergency_reports.
--
-- Problem: attachments jsonb carries multi-MB base64 payloads
-- (images, resolution_proof). select('*') for the incident queue pulls ~8MB
-- for 15 rows, so the board takes seconds to populate and DevTools hangs
-- "formatting" the response.
--
-- This view returns every column but rebuilds attachments keeping only keys
-- whose serialized value is under 8KB — location, contact info, coordinates
-- and status all survive; base64 media is dropped. The detail modal lazily
-- fetches the full row by id when a report is opened, so evidence images
-- still render there.
--
-- security_invoker=on (PG15+, Supabase) keeps the caller's RLS policies on
-- emergency_reports in force — without it the view would read as the view
-- owner and bypass RLS entirely. Run once in the Supabase SQL editor.

CREATE OR REPLACE VIEW public.emergency_reports_list
WITH (security_invoker = on) AS
SELECT
    id,
    incident_id,
    reporter_id,
    report_type,
    content,
    created_at,
    updated_at,
    assigned_to,
    assigned_department_id,
    report_id,
    status,
    priority,
    resolved_at,
    (
        SELECT COALESCE(jsonb_object_agg(e.k, e.v), '{}'::jsonb)
        FROM jsonb_each(COALESCE(attachments, '{}'::jsonb)) AS e(k, v)
        WHERE octet_length(e.v::text) < 8192
    ) AS attachments
FROM public.emergency_reports;
