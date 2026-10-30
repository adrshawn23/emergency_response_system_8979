-- ============================================================================
-- Admin RBAC controls for user_profiles.
-- Run this in the Supabase SQL editor. It does three things:
--
--   1. Lets admins UPDATE any user_profiles row (role / status /
--      account_status edits from the Residents & review page).
--   2. Adds a trigger so NO user can change their own privileged fields —
--      closes the "users_manage_own_user_profiles FOR ALL" hole where a
--      resident could set their own role = 'admin' via the API.
--   3. Publishes user_profiles to supabase_realtime so role/suspension
--      changes reach logged-in sessions live.
--
-- Safe to re-run (DROP/IF EXISTS everywhere).
-- ============================================================================

BEGIN;

-- ── 1. Admin UPDATE policy ────────────────────────────────────────────────
-- is_admin() reads user_profiles with SECURITY DEFINER, so the role column is
-- the single source of truth — no dependence on auth.users metadata staying
-- in sync, and a resident promoted to admin is recognized immediately.
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.user_profiles
        WHERE id = auth.uid() AND role = 'admin'
    );
$$;

DROP POLICY IF EXISTS "admin_update_user_profiles" ON public.user_profiles;
CREATE POLICY "admin_update_user_profiles"
    ON public.user_profiles
    FOR UPDATE
    TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- ── 2. Privileged-field guard ─────────────────────────────────────────────
-- A user editing their own row may NOT touch role / status / account_status.
-- Admins editing OTHER users are unaffected (auth.uid() <> OLD.id), and
-- service-role/system writes (auth.uid() IS NULL) pass through.
-- Side effect: an admin cannot demote/suspend themselves — prevents lockout.
CREATE OR REPLACE FUNCTION public.user_profiles_guard_privileged()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF auth.uid() IS NOT NULL
       AND auth.uid() = OLD.id
       AND (
            NEW.role IS DISTINCT FROM OLD.role
         OR NEW.status IS DISTINCT FROM OLD.status
         OR NEW.account_status IS DISTINCT FROM OLD.account_status
       )
    THEN
        RAISE EXCEPTION 'role, status and account_status can only be changed by an administrator';
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS user_profiles_guard_privileged
    ON public.user_profiles;
CREATE TRIGGER user_profiles_guard_privileged
    BEFORE UPDATE ON public.user_profiles
    FOR EACH ROW EXECUTE FUNCTION public.user_profiles_guard_privileged();

-- ── 3. Realtime publication ───────────────────────────────────────────────
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime'
          AND schemaname = 'public'
          AND tablename = 'user_profiles'
    ) THEN
        ALTER PUBLICATION supabase_realtime
            ADD TABLE public.user_profiles;
    END IF;
END $$;

COMMIT;

-- Quick check afterwards:
--   SELECT tablename FROM pg_publication_tables WHERE pubname='supabase_realtime';
--   SELECT policyname FROM pg_policies WHERE tablename='user_profiles';
