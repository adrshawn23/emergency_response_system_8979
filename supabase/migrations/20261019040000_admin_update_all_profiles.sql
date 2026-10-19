-- Allow admins to update all user_profiles for department assignment
-- This enables the admin to assign users to departments

DROP POLICY IF EXISTS "Admins can update all profiles" ON public.user_profiles;

CREATE POLICY "Admins can update all profiles" ON public.user_profiles
    FOR UPDATE USING (public.is_admin());
