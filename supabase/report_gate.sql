-- report_gate.sql — RUN IN SUPABASE SQL EDITOR
--
-- BUG: pending residents could file emergency reports. Cause: the original
-- "residents_manage_own_reports" policy is FOR ALL and appears as cmd='ALL'
-- in pg_policies, so the enforcement migration's INSERT-only cleanup loop
-- never dropped it. This file applies the corrected gate directly.
--
-- Effect: only residents with account_status='active' (and staff roles)
-- may INSERT into emergency_reports. Read/update/delete of a resident's
-- own reports is preserved by the policies recreated below.

-- 1. Gate function (same as the enforcement migration) --------------------
CREATE OR REPLACE FUNCTION public.caller_can_report()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE id = auth.uid()
      AND (
        role IN ('dispatcher', 'responder', 'admin')
        OR (role = 'resident' AND COALESCE(account_status, 'pending') = 'active')
      )
  );
$$;

-- 2. Drop every policy that can permit an INSERT (INSERT + ALL cmds) -----
DO $$
DECLARE
  p record;
BEGIN
  FOR p IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'emergency_reports'
      AND cmd IN ('INSERT', 'ALL')
  LOOP
    EXECUTE format('DROP POLICY %I ON public.emergency_reports', p.policyname);
  END LOOP;
END $$;

-- 3. The gated INSERT policy ---------------------------------------------
DROP POLICY IF EXISTS "active_accounts_insert_reports" ON public.emergency_reports;
CREATE POLICY "active_accounts_insert_reports" ON public.emergency_reports
  FOR INSERT TO authenticated
  WITH CHECK (reporter_id = auth.uid() AND public.caller_can_report());

-- 4. Restore the non-INSERT halves of the dropped FOR ALL policy ---------
DROP POLICY IF EXISTS "residents_view_own_reports" ON public.emergency_reports;
CREATE POLICY "residents_view_own_reports" ON public.emergency_reports
  FOR SELECT TO authenticated
  USING (reporter_id = auth.uid());

DROP POLICY IF EXISTS "residents_update_own_reports" ON public.emergency_reports;
CREATE POLICY "residents_update_own_reports" ON public.emergency_reports
  FOR UPDATE TO authenticated
  USING (reporter_id = auth.uid())
  WITH CHECK (reporter_id = auth.uid());

DROP POLICY IF EXISTS "residents_delete_own_reports" ON public.emergency_reports;
CREATE POLICY "residents_delete_own_reports" ON public.emergency_reports
  FOR DELETE TO authenticated
  USING (reporter_id = auth.uid());

-- 5. Verify: should list exactly these four policies, none FOR ALL -------
SELECT policyname, cmd FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'emergency_reports';
