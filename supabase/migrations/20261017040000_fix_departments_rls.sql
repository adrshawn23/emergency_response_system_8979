-- Fix departments RLS policy to use is_admin() function instead of raw_user_meta_data
-- This aligns with the newer migration pattern and checks user_profiles.role

-- Drop old policy
DROP POLICY IF EXISTS "admin_manage_departments" ON public.departments;

-- Create new policy using is_admin() function
CREATE POLICY "admin_manage_departments"
ON public.departments
FOR ALL
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());
