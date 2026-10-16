-- Tighten operational access: administrators inspect, dispatchers coordinate,
-- and responders act only on incidents assigned to them or their department.

CREATE OR REPLACE FUNCTION public.is_assigned_responder(target_report_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.emergency_reports er
    LEFT JOIN public.incident_assignments ia ON ia.incident_id = er.id AND ia.closed_at IS NULL
    LEFT JOIN public.department_memberships dm ON dm.department_id = ia.department_id
      AND dm.user_id = auth.uid() AND dm.active
    WHERE er.id = target_report_id
      AND (er.assigned_to = auth.uid() OR ia.responder_id = auth.uid() OR dm.user_id = auth.uid())
  )
$$;

DROP POLICY IF EXISTS "staff_view_all_reports" ON public.emergency_reports;
DROP POLICY IF EXISTS "staff_update_reports" ON public.emergency_reports;
DROP POLICY IF EXISTS "dispatchers_view_reports" ON public.emergency_reports;
DROP POLICY IF EXISTS "responders_view_assigned_reports" ON public.emergency_reports;
DROP POLICY IF EXISTS "dispatchers_update_reports" ON public.emergency_reports;
DROP POLICY IF EXISTS "responders_update_assigned_reports" ON public.emergency_reports;

CREATE POLICY "dispatchers_and_admins_view_reports"
ON public.emergency_reports FOR SELECT TO authenticated
USING (public.is_dispatcher() OR public.is_admin());

CREATE POLICY "responders_view_assigned_reports"
ON public.emergency_reports FOR SELECT TO authenticated
USING (public.is_assigned_responder(id));

CREATE POLICY "dispatchers_update_reports"
ON public.emergency_reports FOR UPDATE TO authenticated
USING (public.is_dispatcher()) WITH CHECK (public.is_dispatcher());

CREATE POLICY "responders_update_assigned_reports"
ON public.emergency_reports FOR UPDATE TO authenticated
USING (public.is_assigned_responder(id)) WITH CHECK (public.is_assigned_responder(id));

-- Administrators retain read/audit access but do not receive operational
-- incident-update permission through this policy.
DROP POLICY IF EXISTS "admins_read_audit_logs" ON public.audit_logs;
CREATE POLICY "admins_read_audit_logs" ON public.audit_logs
FOR SELECT TO authenticated USING (public.is_admin());
