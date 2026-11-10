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

-- 5. Ad-hoc live test accounts (verify-id, report-gate, and OTP delivery tests).
DELETE FROM public.id_verifications iv
USING public.user_profiles p
WHERE iv.user_id = p.id
  AND (p.email LIKE 'test.%@yopmail.com'
       OR p.email LIKE 'shawnmichaeldagatan+%@gmail.com');

DELETE FROM public.user_profiles
WHERE email LIKE 'test.%@yopmail.com'
   OR email LIKE 'shawnmichaeldagatan+%@gmail.com';

DELETE FROM auth.users
WHERE email LIKE 'test.%@yopmail.com'
   OR email LIKE 'shawnmichaeldagatan+%@gmail.com';

-- 6. E2E-seeded operational data. Seed helpers stamp content with 'E2E'
--    (e.g. "E2E assist 1234") and CDA rows with notes = 'e2e seed'.
--    Children first; incident_status_history also cascades on report delete.
DELETE FROM public.notifications n
USING public.emergency_reports er
WHERE n.incident_id = er.id
  AND er.content ILIKE 'E2E%';

DELETE FROM public.cross_department_assistance cda
USING public.emergency_reports er
WHERE cda.report_id = er.id
  AND (er.content ILIKE 'E2E%' OR cda.notes = 'e2e seed');

DELETE FROM public.responder_backup_requests rbr
USING public.emergency_reports er
WHERE rbr.report_id = er.id
  AND er.content ILIKE 'E2E%';

DELETE FROM public.incident_status_history h
USING public.emergency_reports er
WHERE h.report_id = er.id
  AND er.content ILIKE 'E2E%';

DELETE FROM public.emergency_reports
WHERE content ILIKE 'E2E%';

-- 7. Stale responder pins left by location/arrival seeds — rows re-write
--    automatically the next time a responder goes on duty.
DELETE FROM public.responder_locations;

-- 8. Review what remains (expect only real accounts/reports).
-- SELECT email, role, account_status FROM public.user_profiles;
-- SELECT content, status FROM public.emergency_reports;
