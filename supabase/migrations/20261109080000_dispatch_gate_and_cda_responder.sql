-- Dispatch gate + per-department responder assignment.
--
-- Flow change: the dispatcher assigns the MAIN department first — only then
-- do cross-department assistance requests go out. Previously the trigger
-- fired on report INSERT, so CDA rows existed before any department owned
-- the incident. Now it fires when assigned_department_id is set/changed.
--
-- Each department (main OR assisting) then assigns its own responder:
--  - main dept → report.assigned_to (existing dept_admin policy)
--  - assisting dept → cda.responder_id (new column + policy below)
--
-- Apply via Supabase SQL editor.

BEGIN;

-- 1) CDA gains an optional responder assignment — who the assisting
--    department's admin is sending.
ALTER TABLE public.cross_department_assistance
    ADD COLUMN IF NOT EXISTS responder_id UUID
    REFERENCES public.user_profiles(id) ON DELETE SET NULL;

-- 2) Retarget the auto-dispatch trigger: fire when a main department is
--    assigned (or changed), not on insert. Function itself is unchanged —
--    it already skips NEW.assigned_department_id and upsert-dedupes.
DROP TRIGGER IF EXISTS trg_auto_dispatch_assistance ON public.emergency_reports;
CREATE TRIGGER trg_auto_dispatch_assistance
    AFTER INSERT OR UPDATE OF assigned_department_id ON public.emergency_reports
    FOR EACH ROW
    WHEN (NEW.assigned_department_id IS NOT NULL)
    EXECUTE FUNCTION public.auto_dispatch_assistance();

-- 3) dept_admin report updates: gate the updatable ROWS, not just the
--    written values. CHECK can't see the OLD row, so without the USING gate
--    a dept admin could overwrite another department's assignment.
DROP POLICY IF EXISTS "dept_admin_update_reports" ON public.emergency_reports;
CREATE POLICY "dept_admin_update_reports"
    ON public.emergency_reports FOR UPDATE TO authenticated
    USING (
        public.is_department_admin()
        AND (
            assigned_department_id IS NULL
            OR assigned_department_id = public.my_department_id()
        )
    )
    WITH CHECK (
        public.is_department_admin()
        AND (
            assigned_department_id IS NULL
            OR assigned_department_id = public.my_department_id()
        )
        AND (
            assigned_to IS NULL
            OR EXISTS (
                SELECT 1 FROM public.user_profiles r
                WHERE r.id = assigned_to
                  AND r.department_id = public.my_department_id()
            )
        )
    );

-- 4) dept_admin CDA updates: also allow setting responder_id, but only to a
--    member of their own department (the row's assisting dept = their dept).
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
            )
        )
    );

COMMIT;
