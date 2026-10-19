-- Allow dispatchers to update emergency_reports for incident assignment
-- This enables dispatchers to assign incidents to responders and departments

DROP POLICY IF EXISTS "Dispatchers can assign incidents" ON public.emergency_reports;

CREATE POLICY "Dispatchers can assign incidents" ON public.emergency_reports
    FOR UPDATE USING (
        (SELECT role FROM public.user_profiles WHERE id = auth.uid()) = 'dispatcher'
    );
