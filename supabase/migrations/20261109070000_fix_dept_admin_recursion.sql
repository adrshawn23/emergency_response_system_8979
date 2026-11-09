-- HOTFIX: 500 on user_profiles reads (infinite recursion).
-- dept_admin_read_dept_profiles queried user_profiles inside a
-- user_profiles policy → Postgres recurses evaluating it (42P17 → 500).
-- Fix: mirror the codebase's is_admin()/is_dispatcher() pattern — a
-- SECURITY DEFINER helper reads the role without triggering RLS.
--
-- Run in the SQL editor. If profile reads are broken RIGHT NOW and you
-- need instant relief first, run just this line:
--   DROP POLICY IF EXISTS "dept_admin_read_dept_profiles" ON public.user_profiles;

BEGIN;

-- SECURITY DEFINER role check — the policy-time user_profiles read no
-- longer evaluates user_profiles policies (owner bypasses RLS).
CREATE OR REPLACE FUNCTION public.is_department_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.user_profiles
        WHERE id = auth.uid() AND role = 'department_admin'
    )
$$;

-- user_profiles: dept members of the caller's department, no self-query.
DROP POLICY IF EXISTS "dept_admin_read_dept_profiles" ON public.user_profiles;
CREATE POLICY "dept_admin_read_dept_profiles"
    ON public.user_profiles FOR SELECT TO authenticated
    USING (
        public.is_department_admin()
        AND department_id = public.my_department_id()
    );

-- Recreate the other dept_admin policies on the helper too — the inline
-- EXISTS evaluated user_profiles RLS, which recursed into the broken
-- policy above. Same semantics, no recursion.
DROP POLICY IF EXISTS "dept_admin_view_reports" ON public.emergency_reports;
CREATE POLICY "dept_admin_view_reports"
    ON public.emergency_reports FOR SELECT TO authenticated
    USING (public.is_department_admin());

DROP POLICY IF EXISTS "dept_admin_update_reports" ON public.emergency_reports;
CREATE POLICY "dept_admin_update_reports"
    ON public.emergency_reports FOR UPDATE TO authenticated
    USING (public.is_department_admin())
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

DROP POLICY IF EXISTS "dept_admin_cda_select" ON public.cross_department_assistance;
CREATE POLICY "dept_admin_cda_select"
    ON public.cross_department_assistance FOR SELECT TO authenticated
    USING (
        public.is_department_admin()
        AND assisting_department_id = public.my_department_id()
    );

DROP POLICY IF EXISTS "dept_admin_cda_update" ON public.cross_department_assistance;
CREATE POLICY "dept_admin_cda_update"
    ON public.cross_department_assistance FOR UPDATE TO authenticated
    USING (
        public.is_department_admin()
        AND assisting_department_id = public.my_department_id()
    )
    WITH CHECK (
        public.is_department_admin()
        AND assisting_department_id = public.my_department_id()
    );

DROP POLICY IF EXISTS "dept_admin_history_read" ON public.incident_status_history;
CREATE POLICY "dept_admin_history_read"
    ON public.incident_status_history FOR SELECT TO authenticated
    USING (public.is_department_admin());

COMMIT;
