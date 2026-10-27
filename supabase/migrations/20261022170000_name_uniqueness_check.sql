-- Allow anonymous users to check whether a full_name is already registered.
-- RLS blocks anonymous SELECTs on user_profiles, so the duplicate-name guard
-- in register/index.jsx silently passed every time. A SECURITY DEFINER
-- function checks the name without exposing profile rows.

BEGIN;

CREATE OR REPLACE FUNCTION public.is_name_taken(p_name TEXT)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.user_profiles WHERE full_name = p_name
    );
$$;

GRANT EXECUTE ON FUNCTION public.is_name_taken(TEXT) TO anon, authenticated;

COMMIT;
