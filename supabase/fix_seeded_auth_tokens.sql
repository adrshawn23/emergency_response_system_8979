-- One-time repair for accounts created by seed_department_responders.sql
-- (before the token-column fix). Gotrue 500s on sign-in when token columns
-- are NULL — it expects empty strings. Real accounts always have '' so
-- "token IS NULL" uniquely identifies the seeded rows. Run once in the
-- SQL editor, then sign in again — no password change needed.

UPDATE auth.users SET
    confirmation_token         = COALESCE(confirmation_token, ''),
    recovery_token             = COALESCE(recovery_token, ''),
    reauthentication_token     = COALESCE(reauthentication_token, ''),
    email_change_token_new     = COALESCE(email_change_token_new, ''),
    email_change_token_current = COALESCE(email_change_token_current, ''),
    email_change               = COALESCE(email_change, ''),
    updated_at                 = now()
WHERE confirmation_token IS NULL
   OR recovery_token IS NULL
   OR reauthentication_token IS NULL;

-- Verify: should return 0 rows.
SELECT email FROM auth.users
WHERE confirmation_token IS NULL OR recovery_token IS NULL;
