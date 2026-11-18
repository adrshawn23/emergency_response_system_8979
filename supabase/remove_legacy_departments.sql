-- Remove the legacy generic departments, leaving only the three barangay
-- response groups:
--   Disaster Response Team (BDRRMC)  ·  Barangay Tanod / Peace and Order
--   Health and First Aid Team
--
-- What this does, in dependency order:
--   1. Remaps reports assigned to a legacy dept to the matching barangay group
--      (Fire Dept -> DRT, Police Dept -> Tanod, EMS -> Health & First Aid).
--   2. Deletes child rows in tables whose FK is RESTRICT (would block the
--      DELETE): reassignment_requests, department_memberships,
--      incident_assignments, assistance_requests.
--   3. Removes legacy seed staff (fire/police/EMS responder+admin logins and
--      their auth.users rows). Other users linked to a legacy dept are
--      remapped to the matching barangay group instead of orphaned.
--   4. Deletes the legacy department rows (CDA and backup-request rows
--      cascade automatically).
--
-- Safe to re-run (all steps guard on existence). Run in the SQL editor
-- AFTER 20261116110000_barangay_response_groups.sql.

BEGIN;

-- ----------------------------------------------------------------
-- 0. Resolve the three barangay group ids once.
-- ----------------------------------------------------------------
CREATE TEMP TABLE _new_depts ON COMMIT DROP AS
SELECT
    (SELECT id FROM public.departments WHERE name = 'Disaster Response Team (BDRRMC)')     AS drt,
    (SELECT id FROM public.departments WHERE name = 'Barangay Tanod / Peace and Order')    AS tanod,
    (SELECT id FROM public.departments WHERE name = 'Health and First Aid Team')           AS health;

CREATE TEMP TABLE _legacy_depts ON COMMIT DROP AS
SELECT
    (SELECT id FROM public.departments WHERE name = 'Fire Department')                     AS fire,
    (SELECT id FROM public.departments WHERE name = 'Police Department')                   AS police,
    (SELECT id FROM public.departments WHERE name = 'Emergency Medical Services')          AS ems;

-- Abort early if the barangay groups don't exist yet.
DO $$
BEGIN
    IF (SELECT drt IS NULL OR tanod IS NULL OR health IS NULL FROM _new_depts) THEN
        RAISE EXCEPTION 'Barangay response groups not found — run 20261116110000_barangay_response_groups.sql first';
    END IF;
END $$;

-- ----------------------------------------------------------------
-- 1. Remap reports from legacy dept -> matching barangay group.
-- ----------------------------------------------------------------
UPDATE public.emergency_reports r
SET assigned_department_id = CASE
        WHEN r.assigned_department_id = (SELECT fire   FROM _legacy_depts) THEN (SELECT drt    FROM _new_depts)
        WHEN r.assigned_department_id = (SELECT police FROM _legacy_depts) THEN (SELECT tanod  FROM _new_depts)
        ELSE (SELECT health FROM _new_depts)
    END,
    updated_at = now()
WHERE r.assigned_department_id IN (
    SELECT fire FROM _legacy_depts
    UNION ALL SELECT police FROM _legacy_depts
    UNION ALL SELECT ems    FROM _legacy_depts
);

-- ----------------------------------------------------------------
-- 2. Clear RESTRICT-FK child rows that would block the DELETE.
--    Some tables only exist if older migrations were applied — guard
--    each delete so a missing table can't abort the script.
-- ----------------------------------------------------------------
DO $$
BEGIN
    BEGIN
        DELETE FROM public.reassignment_requests
        WHERE department_id IN (SELECT fire FROM _legacy_depts UNION ALL SELECT police FROM _legacy_depts UNION ALL SELECT ems FROM _legacy_depts);
    EXCEPTION WHEN undefined_table OR undefined_column THEN NULL;
    END;

    BEGIN
        DELETE FROM public.department_memberships
        WHERE department_id IN (SELECT fire FROM _legacy_depts UNION ALL SELECT police FROM _legacy_depts UNION ALL SELECT ems FROM _legacy_depts);
    EXCEPTION WHEN undefined_table OR undefined_column THEN NULL;
    END;

    BEGIN
        DELETE FROM public.incident_assignments
        WHERE department_id IN (SELECT fire FROM _legacy_depts UNION ALL SELECT police FROM _legacy_depts UNION ALL SELECT ems FROM _legacy_depts);
    EXCEPTION WHEN undefined_table OR undefined_column THEN NULL;
    END;

    BEGIN
        DELETE FROM public.assistance_requests
        WHERE target_department_id IN (SELECT fire FROM _legacy_depts UNION ALL SELECT police FROM _legacy_depts UNION ALL SELECT ems FROM _legacy_depts);
    EXCEPTION WHEN undefined_table OR undefined_column THEN NULL;
    END;

    -- Contacts tagged to a legacy dept would dangle (SET NULL) — remove them.
    BEGIN
        DELETE FROM public.department_contacts
        WHERE department_id IN (SELECT fire FROM _legacy_depts UNION ALL SELECT police FROM _legacy_depts UNION ALL SELECT ems FROM _legacy_depts);
    EXCEPTION WHEN undefined_table OR undefined_column THEN NULL;
    END;
END $$;

-- ----------------------------------------------------------------
-- 3. Legacy seed staff: delete profiles + auth identities + auth users.
--    Any OTHER profile still on a legacy dept is remapped to the
--    matching barangay group rather than orphaned.
-- ----------------------------------------------------------------
CREATE TEMP TABLE _legacy_staff ON COMMIT DROP AS
SELECT id, email FROM public.user_profiles
WHERE email ~ '^(deptadmin\.(fire|police|emergencymedicalservices)|(fire|police|emergencymedicalservices)\.responder[0-9]+)@emergency\.gov$'
   OR email IN ('responder@emergency.gov');   -- original 'First Responder' seed on Fire Dept

DELETE FROM public.user_profiles WHERE id IN (SELECT id FROM _legacy_staff);
DELETE FROM auth.identities      WHERE user_id IN (SELECT id FROM _legacy_staff);
DELETE FROM auth.users           WHERE id IN (SELECT id FROM _legacy_staff);

UPDATE public.user_profiles p
SET department_id = CASE
        WHEN p.department_id = (SELECT fire   FROM _legacy_depts) THEN (SELECT drt    FROM _new_depts)
        WHEN p.department_id = (SELECT police FROM _legacy_depts) THEN (SELECT tanod  FROM _new_depts)
        ELSE (SELECT health FROM _new_depts)
    END,
    updated_at = now()
WHERE p.department_id IN (
    SELECT fire FROM _legacy_depts
    UNION ALL SELECT police FROM _legacy_depts
    UNION ALL SELECT ems    FROM _legacy_depts
);

-- ----------------------------------------------------------------
-- 4. Delete the legacy departments (CDA + backup rows cascade).
--    E2E test department is included — remove that line if needed.
-- ----------------------------------------------------------------
DELETE FROM public.departments
WHERE name IN (
    'Fire Department', 'Police Department', 'Emergency Medical Services',
    'Medical Services', 'Emergency Management', 'E2E Fire Dept'
);

COMMIT;

-- Verify: only the barangay groups (plus any intentionally kept depts) remain.
SELECT name, type, status FROM public.departments ORDER BY name;
SELECT d.name AS department, p.email, p.role
FROM public.user_profiles p
JOIN public.departments d ON d.id = p.department_id
WHERE p.role IN ('responder', 'department_admin')
ORDER BY d.name, p.role DESC, p.email;
