-- Allow admins to read all user_profiles for department assignment
-- This enables the admin to see all users when assigning them to departments

DROP POLICY IF EXISTS "Admins can read all profiles" ON public.user_profiles;

CREATE POLICY "Admins can read all profiles" ON public.user_profiles
    FOR SELECT USING (public.is_admin());
