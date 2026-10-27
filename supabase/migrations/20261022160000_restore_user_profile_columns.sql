-- Restore user_profiles columns that registration and admin review write to.
-- The live table lost these columns during schema drift; code in
-- register/index.jsx and dashboard/index.jsx references them and fails
-- with Postgres 42703 without them.

BEGIN;

ALTER TABLE public.user_profiles
    ADD COLUMN IF NOT EXISTS first_name TEXT,
    ADD COLUMN IF NOT EXISTS last_name TEXT,
    ADD COLUMN IF NOT EXISTS birthdate DATE,
    ADD COLUMN IF NOT EXISTS address TEXT,
    ADD COLUMN IF NOT EXISTS account_status TEXT DEFAULT 'active';

-- Backfill first/last name from full_name for existing users
UPDATE public.user_profiles
SET
    first_name = split_part(full_name, ' ', 1),
    last_name = NULLIF(btrim(regexp_replace(full_name, '^\S+\s*', '')), '')
WHERE first_name IS NULL AND full_name IS NOT NULL;

-- Existing active accounts should read 'active', pending/inactive 'pending'
UPDATE public.user_profiles
SET account_status = CASE WHEN status = 'active' THEN 'active' ELSE 'pending' END
WHERE account_status IS NULL;

COMMIT;
