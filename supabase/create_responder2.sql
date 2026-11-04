-- Creates the responder2 test account's profile and confirms its email.
-- The auth user already exists (signed up via the app): responder2@emergency.gov
-- Run this once in the Supabase SQL editor, then log in as:
--   responder2@emergency.gov / responder123

-- 1. Confirm the email so the account can sign in
UPDATE auth.users
SET email_confirmed_at = now()
WHERE email = 'responder2@emergency.gov'
  AND email_confirmed_at IS NULL;

-- 2. Create the responder profile in Emergency Medical Services
INSERT INTO public.user_profiles
    (id, email, full_name, first_name, last_name, role, department_id, account_status, status)
VALUES (
    '8a1c448a-7151-4ceb-a56b-0e360c5c8af1',
    'responder2@emergency.gov',
    'EMS Responder',
    'EMS',
    'Responder',
    'responder',
    '0de32c3e-6373-42a9-88e4-c8d9d08f4e61',  -- Emergency Medical Services
    'active',
    'active'
)
ON CONFLICT (id) DO UPDATE SET
    role = 'responder',
    department_id = '0de32c3e-6373-42a9-88e4-c8d9d08f4e61',
    account_status = 'active',
    status = 'active';
