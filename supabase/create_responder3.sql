-- Creates the responder3 test account's profile in the Police Department
-- and confirms its email so the account can sign in immediately.
--
-- 1) Sign up via the app first: responder3@emergency.gov / responder123
--    (Supabase must own the auth.users row and hashed password.)
-- 2) Run this once in the Supabase SQL editor, then log in as:
--      responder3@emergency.gov / responder123

-- Confirm the email so the account can sign in
UPDATE auth.users
SET email_confirmed_at = now()
WHERE email = 'responder3@emergency.gov'
  AND email_confirmed_at IS NULL;

-- Create/update the responder profile, linked to whichever department is
-- the police one (department ids are generated at seed time, so look it up
-- rather than hardcoding a UUID).
WITH police_dept AS (
  SELECT id
  FROM public.departments
  WHERE name ILIKE '%police%'
  LIMIT 1
)
INSERT INTO public.user_profiles
    (id, email, full_name, first_name, last_name, role, department_id, account_status, status)
SELECT
    u.id,
    'responder3@emergency.gov',
    'Police Responder',
    'Police',
    'Responder',
    'responder',
    d.id,
    'active',
    'active'
FROM auth.users u
CROSS JOIN police_dept d
WHERE u.email = 'responder3@emergency.gov'
ON CONFLICT (id) DO UPDATE SET
    role = 'responder',
    department_id = EXCLUDED.department_id,
    account_status = 'active',
    status = 'active';
