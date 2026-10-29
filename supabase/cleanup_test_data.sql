-- One-time E2E/test-data cleanup for the live database.
-- Run in the Supabase SQL editor — the postgres role bypasses RLS.
-- (The publishable key cannot delete user_profiles or id_verifications:
-- admin deletes return 0 rows with no error. Verified 2026-10-29.)
--
-- Safe to re-run: every statement is a no-op when nothing matches.

-- 1. Verification + contact rows that belong to e2e.* test profiles.
DELETE FROM public.id_verifications iv
USING public.user_profiles p
WHERE iv.user_id = p.id
  AND p.email LIKE 'e2e.%';

DELETE FROM public.emergency_contacts ec
USING public.user_profiles p
WHERE ec.user_id = p.id
  AND p.email LIKE 'e2e.%';

-- 2. E2E-seeded verification rows on REAL accounts (admin's 'E2E seed' rows
--    and auto-approved 'E2E Test User' OCR seeds).
DELETE FROM public.id_verifications
WHERE id_document_url = 'e2e_seed'
   OR ocr_data->>'extracted_name' = 'E2E Test User';

-- 3. The e2e.* test profiles themselves.
DELETE FROM public.user_profiles
WHERE email LIKE 'e2e.%';

-- 4. Orphaned auth users left behind by test signups. The publishable key
--    can never touch auth.users — these only appear in the dashboard's
--    Authentication panel otherwise.
DELETE FROM auth.users
WHERE email LIKE 'e2e.%';

-- 5. Review what remains (expect only real accounts/reports).
-- SELECT email, role, account_status FROM public.user_profiles;
-- SELECT content, status FROM public.emergency_reports;
