-- Let responders request cross-department assistance on incidents assigned
-- to them. Previously INSERT was staff-only (admin/dispatcher), so the
-- responder request button had no way to persist.
-- Apply via the Supabase SQL editor.

DROP POLICY IF EXISTS responders_request_assistance ON public.cross_department_assistance;
CREATE POLICY "responders_request_assistance" ON public.cross_department_assistance
FOR INSERT TO authenticated
WITH CHECK (
  requested_by::text = auth.uid()::text
  AND EXISTS (
    SELECT 1 FROM public.emergency_reports r
    WHERE r.id = report_id
      AND r.assigned_to::text = auth.uid()::text
  )
);
