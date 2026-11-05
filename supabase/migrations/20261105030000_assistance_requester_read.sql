-- The responder who REQUESTED cross-department assistance must see the
-- request's outcome. The original policies only let the TARGET department's
-- responders and staff read rows, so a requester could send a request but
-- never see it become accepted (or who accepted it).
DROP POLICY IF EXISTS "assistance_requester_read" ON public.cross_department_assistance;
CREATE POLICY "assistance_requester_read"
    ON public.cross_department_assistance
    FOR SELECT
    TO authenticated
    USING (requested_by = auth.uid());
