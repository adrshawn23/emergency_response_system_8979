-- department_admin role: a per-department operator who sees the incident
-- queue and assigns responders — but ONLY responders inside their own
-- department. Pairs with auto-dispatch: the system pings the departments,
-- each department_admin picks who goes.
--
-- Apply via Supabase SQL editor (migrations are applied manually).
-- NOTE: ALTER TYPE must run outside the transaction (new enum value can
-- only be referenced after it commits).

ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'department_admin';

BEGIN;

-- Convenience: the caller's own department_id.
CREATE OR REPLACE FUNCTION public.my_department_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
    SELECT department_id FROM public.user_profiles WHERE id = auth.uid()
$$;

-- ---------------------------------------------------------------------------
-- emergency_reports — see the whole queue; update only with dept-scoped
-- assignments (assigned dept = own, assigned responder belongs to own dept).
-- Status transitions ride along with the assignment update.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "dept_admin_view_reports" ON public.emergency_reports;
CREATE POLICY "dept_admin_view_reports"
    ON public.emergency_reports FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles up
            WHERE up.id = auth.uid() AND up.role = 'department_admin'
        )
    );

DROP POLICY IF EXISTS "dept_admin_update_reports" ON public.emergency_reports;
CREATE POLICY "dept_admin_update_reports"
    ON public.emergency_reports FOR UPDATE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles up
            WHERE up.id = auth.uid() AND up.role = 'department_admin'
        )
    )
    WITH CHECK (
        (assigned_department_id IS NULL OR assigned_department_id = public.my_department_id())
        AND (
            assigned_to IS NULL
            OR EXISTS (
                SELECT 1 FROM public.user_profiles r
                WHERE r.id = assigned_to
                  AND r.department_id = public.my_department_id()
            )
        )
    );

-- ---------------------------------------------------------------------------
-- user_profiles — department_admin reads the responders in their own
-- department so the assign dropdown can list them.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "dept_admin_read_dept_profiles" ON public.user_profiles;
CREATE POLICY "dept_admin_read_dept_profiles"
    ON public.user_profiles FOR SELECT TO authenticated
    USING (
        department_id = public.my_department_id()
        AND EXISTS (
            SELECT 1 FROM public.user_profiles up
            WHERE up.id = auth.uid() AND up.role = 'department_admin'
        )
    );

-- ---------------------------------------------------------------------------
-- cross_department_assistance — same visibility/response rights as a
-- responder, but for every request targeted at their department.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "dept_admin_cda_select" ON public.cross_department_assistance;
CREATE POLICY "dept_admin_cda_select"
    ON public.cross_department_assistance FOR SELECT TO authenticated
    USING (
        assisting_department_id = public.my_department_id()
        AND EXISTS (
            SELECT 1 FROM public.user_profiles up
            WHERE up.id = auth.uid() AND up.role = 'department_admin'
        )
    );

DROP POLICY IF EXISTS "dept_admin_cda_update" ON public.cross_department_assistance;
CREATE POLICY "dept_admin_cda_update"
    ON public.cross_department_assistance FOR UPDATE TO authenticated
    USING (
        assisting_department_id = public.my_department_id()
        AND EXISTS (
            SELECT 1 FROM public.user_profiles up
            WHERE up.id = auth.uid() AND up.role = 'department_admin'
        )
    )
    WITH CHECK (
        assisting_department_id = public.my_department_id()
        AND EXISTS (
            SELECT 1 FROM public.user_profiles up
            WHERE up.id = auth.uid() AND up.role = 'department_admin'
        )
    );

-- ---------------------------------------------------------------------------
-- incident_status_history — read the timeline for incidents they're working.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "dept_admin_history_read" ON public.incident_status_history;
CREATE POLICY "dept_admin_history_read"
    ON public.incident_status_history FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles up
            WHERE up.id = auth.uid() AND up.role = 'department_admin'
        )
    );

-- ---------------------------------------------------------------------------
-- page_permissions — grant queue access in the editable matrix too
-- (DEFAULT_PAGE_ROLES in AuthContext.jsx is updated in the same change set).
-- ---------------------------------------------------------------------------
UPDATE public.page_permissions
SET allowed_roles = array_append(allowed_roles, 'department_admin')
WHERE page_key = 'queue'
  AND NOT 'department_admin' = ANY (allowed_roles);

UPDATE public.page_permissions
SET allowed_roles = array_append(allowed_roles, 'department_admin')
WHERE page_key = 'profile'
  AND NOT 'department_admin' = ANY (allowed_roles);

COMMIT;
