-- Admin RBAC controls for user_profiles.
-- 1. Admins can UPDATE any profile (role / status / account_status).
-- 2. Trigger: no user may change their own privileged fields — closes the
--    "users_manage_own_user_profiles FOR ALL" self-escalation hole.
-- 3. Publishes user_profiles to supabase_realtime for live session updates.
-- Mirrors supabase/admin_user_rbac.sql — keep both in sync.

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
