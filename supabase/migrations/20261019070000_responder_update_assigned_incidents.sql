-- Allow responders to update emergency_reports they are assigned to
-- This enables responders to acknowledge and resolve their assigned incidents

DROP POLICY IF EXISTS "Responders can update assigned incidents" ON public.emergency_reports;

CREATE POLICY "Responders can update assigned incidents" ON public.emergency_reports
    FOR UPDATE USING (
        (SELECT role FROM public.user_profiles WHERE id = auth.uid()) = 'responder'
        AND assigned_to = auth.uid()
    );
