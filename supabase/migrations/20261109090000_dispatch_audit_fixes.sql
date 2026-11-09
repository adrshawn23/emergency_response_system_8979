-- Dispatch audit fixes — specs/002-department-dispatch/findings.md
--
--  D-01  dept_admin could CLAIM unassigned incidents (USING allowed
--        assigned_department_id IS NULL) — bypassing the dispatcher gate
--        and firing auto-dispatch themselves. Now: owned rows only.
--  D-03  reassigning the main dept left stale pending CDA rows aimed at
--        the OLD dept — the function now cancels them.
--  D-04  cda_staff_update let any responder in the targeted dept write
--        responder_id to ANY user (any dept) or overwrite the admin's
--        pick. CHECK now validates responder_id dept-membership.
--  D-05  dept_admin UPDATE was row-scoped only — they could rewrite
--        content/priority/status on their dept's rows. Column guard
--        trigger restricts them to assigned_to/status/updated_at.
--  D-06  assignee CHECKs never verified the assignee is an ACTIVE
--        responder — dept admins could assign residents/inactive members
--        via direct API.
--
-- Apply via Supabase SQL editor.

BEGIN;

-- ---------------------------------------------------------------------------
-- D-01 + D-06 — dept_admin report updates: owned rows only, and assigned_to
-- must be an ACTIVE responder in the admin's own department.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "dept_admin_update_reports" ON public.emergency_reports;
CREATE POLICY "dept_admin_update_reports"
    ON public.emergency_reports FOR UPDATE TO authenticated
    USING (
        public.is_department_admin()
        AND assigned_department_id = public.my_department_id()
    )
    WITH CHECK (
        public.is_department_admin()
        AND assigned_department_id = public.my_department_id()
        AND (
            assigned_to IS NULL
            OR EXISTS (
                SELECT 1 FROM public.user_profiles r
                WHERE r.id = assigned_to
                  AND r.department_id = public.my_department_id()
                  AND r.role = 'responder'
                  AND r.status = 'active'
            )
        )
    );

-- ---------------------------------------------------------------------------
-- D-04 + D-06 — dept_admin CDA updates: responder_id must be an ACTIVE
-- responder in the admin's own department.
-- ---------------------------------------------------------------------------
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
        AND (
            responder_id IS NULL
            OR EXISTS (
                SELECT 1 FROM public.user_profiles r
                WHERE r.id = responder_id
                  AND r.department_id = public.my_department_id()
                  AND r.role = 'responder'
                  AND r.status = 'active'
            )
        )
    );

-- ---------------------------------------------------------------------------
-- D-04 — responders in the targeted dept keep accept/decline rights, but may
-- only set responder_id to an ACTIVE responder in that SAME department.
-- Staff (admin/dispatcher) are unrestricted — they manage all rows.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "cda_staff_update" ON public.cross_department_assistance;
CREATE POLICY cda_staff_update
    ON public.cross_department_assistance FOR UPDATE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles up
            WHERE up.id = auth.uid()
              AND up.role IN ('admin', 'dispatcher')
        )
        OR EXISTS (
            SELECT 1 FROM public.user_profiles up
            WHERE up.id = auth.uid()
              AND up.role = 'responder'
              AND up.department_id = cross_department_assistance.assisting_department_id
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.user_profiles up
            WHERE up.id = auth.uid()
              AND up.role IN ('admin', 'dispatcher')
        )
        OR (
            EXISTS (
                SELECT 1 FROM public.user_profiles up
                WHERE up.id = auth.uid()
                  AND up.role = 'responder'
                  AND up.department_id = cross_department_assistance.assisting_department_id
            )
            AND (
                responder_id IS NULL
                OR EXISTS (
                    SELECT 1 FROM public.user_profiles r
                    WHERE r.id = responder_id
                      AND r.department_id = cross_department_assistance.assisting_department_id
                      AND r.role = 'responder'
                      AND r.status = 'active'
                )
            )
        )
    );

-- ---------------------------------------------------------------------------
-- D-03 — auto_dispatch_assistance: on main-dept REASSIGNMENT, cancel pending
-- auto-dispatch rows aimed at the old main dept (it owns the incident now,
-- it can't assist itself), then insert for the new mapping as before.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.auto_dispatch_assistance()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
    v_types public.department_type[];
BEGIN
    -- Reassignment cleanup first: stale pending auto-dispatch rows aimed at
    -- the OLD main department are cancelled.
    IF TG_OP = 'UPDATE'
       AND OLD.assigned_department_id IS DISTINCT FROM NEW.assigned_department_id
       AND OLD.assigned_department_id IS NOT NULL THEN
        UPDATE public.cross_department_assistance
        SET status = 'cancelled', updated_at = now()
        WHERE report_id = NEW.id
          AND notes = 'auto-dispatch'
          AND status = 'pending'
          AND assisting_department_id = OLD.assigned_department_id;
    END IF;

    -- incident_type -> department types that respond together.
    v_types := CASE NEW.incident_type::text
        WHEN 'fire'     THEN ARRAY['fire', 'medical', 'police']::public.department_type[]
        WHEN 'medical'  THEN ARRAY['medical']::public.department_type[]
        WHEN 'police'   THEN ARRAY['police']::public.department_type[]
        WHEN 'accident' THEN ARRAY['medical', 'police']::public.department_type[]
        WHEN 'natural'  THEN ARRAY['fire', 'medical', 'police', 'emergency_management']::public.department_type[]
        ELSE NULL
    END;

    IF v_types IS NULL THEN
        RETURN NEW;
    END IF;

    INSERT INTO public.cross_department_assistance
        (report_id, assisting_department_id, requested_by, notes)
    SELECT
        NEW.id,
        d.id,
        NEW.reporter_id,
        'auto-dispatch'
    FROM public.departments d
    WHERE d.type = ANY (v_types)
      AND d.id IS DISTINCT FROM NEW.assigned_department_id
    ON CONFLICT (report_id, assisting_department_id) DO NOTHING;

    RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- D-05 — column guard: a department_admin may only change the assignment
-- fields (assigned_to, status, updated_at) on their dept's incidents.
-- Everything else on the row is off-limits. dept_admin is a single role,
-- so is_department_admin() alone identifies the caller.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.dept_admin_report_column_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
    IF public.is_department_admin()
       AND to_jsonb(NEW) - 'assigned_to' - 'status' - 'updated_at'
           IS DISTINCT FROM
           to_jsonb(OLD) - 'assigned_to' - 'status' - 'updated_at' THEN
        RAISE EXCEPTION 'department_admin may only change assigned_to/status on their department''s incidents';
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_dept_admin_report_column_guard ON public.emergency_reports;
CREATE TRIGGER trg_dept_admin_report_column_guard
    BEFORE UPDATE ON public.emergency_reports
    FOR EACH ROW EXECUTE FUNCTION public.dept_admin_report_column_guard();

COMMIT;
