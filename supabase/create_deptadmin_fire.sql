-- Creates the department_admin E2E test account for 'E2E Fire Dept' and
-- confirms its email so it can sign in immediately.
--
-- 1) auth.users row already exists (signed up 2026-11-09 via supabase-js):
--      deptadmin.fire@emergency.gov / deptadmin123
-- 2) Run this once in the Supabase SQL editor.
-- 3) e2e/department_dispatch.spec.js test 3 reads these from .env:
--      E2E_DEPT_ADMIN_EMAIL=deptadmin.fire@emergency.gov
--      E2E_DEPT_ADMIN_PASSWORD=deptadmin123
--
-- The signup trigger (handle_new_user) skips unconfirmed users, and
-- handle_user_confirmed would build a 'resident'/'pending' profile on
-- confirm — so we confirm AND upsert the real profile in one go; the upsert
-- wins on conflict.

-- Confirm the email so the account can sign in
UPDATE auth.users
SET email_confirmed_at = now()
WHERE email = 'deptadmin.fire@emergency.gov'
  AND email_confirmed_at IS NULL;

-- department_admin profile on E2E Fire Dept
WITH fire_dept AS (
  SELECT id
  FROM public.departments
  WHERE name = 'E2E Fire Dept'
  LIMIT 1
)
INSERT INTO public.user_profiles
    (id, email, full_name, first_name, last_name, role, department_id, account_status, status)
SELECT
    u.id,
    'deptadmin.fire@emergency.gov',
    'Fire Dept Admin',
    'Fire',
    'DeptAdmin',
    'department_admin',
    d.id,
    'active',
    'active'
FROM auth.users u
CROSS JOIN fire_dept d
WHERE u.email = 'deptadmin.fire@emergency.gov'
ON CONFLICT (id) DO UPDATE SET
    role = 'department_admin',
    department_id = EXCLUDED.department_id,
    full_name = EXCLUDED.full_name,
    account_status = 'active',
    status = 'active';

-- Verify
SELECT id, email, role, department_id, status, account_status
FROM public.user_profiles
WHERE email = 'deptadmin.fire@emergency.gov';
