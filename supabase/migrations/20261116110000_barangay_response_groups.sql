-- Barangay response groups — replaces the generic Fire/Police/EMS model with
-- the real Kalubihan structure:
--
--   Incident type                    Barangay group                       Outside agency (info only)
--   Flood                            Disaster Response Team (BDRRMC)      Cebu City DRRMO
--   Fire                             Disaster Response Team (evac/coord)  BFP
--   Theft / pickpocketing            Barangay Tanod / Peace and Order      PNP
--   Medical emergency                Health and First Aid Team            DRRMO Ambulance
--   Road accident                    Health/First Aid + Barangay Tanod     DRRMO Ambulance + PNP/traffic
--   Assault / robbery / fight        Barangay Tanod / Peace and Order      PNP (+ ambulance if injured)
--   Fallen tree / structural / trap  Disaster Response Team               Cebu City DRRMO
--
-- department_type enum is reused intentionally (no enum migration needed):
--   Disaster Response Team  -> 'emergency_management'
--   Barangay Tanod          -> 'police'
--   Health and First Aid    -> 'medical'
-- Display names are what users see; the enum stays an internal routing key.
--
-- Outside agencies (BFP/PNP/DRRMO) are NOT departments — they appear to the
-- dispatcher as coordination guidance via src/utils/incidentResponse.js.
--
-- Run AFTER via seed_department_responders.sql to create 2 responders + a
-- dept admin for each new department.
--
-- Apply via Supabase SQL editor.

BEGIN;

-- 1. Create the three barangay response groups (idempotent by name).
INSERT INTO public.departments (name, type, description, status)
SELECT 'Disaster Response Team (BDRRMC)', 'emergency_management',
       'Barangay Disaster Risk Reduction and Management Committee — floods, fires, structural rescue, evacuation', 'active'
WHERE NOT EXISTS (SELECT 1 FROM public.departments WHERE name = 'Disaster Response Team (BDRRMC)');

INSERT INTO public.departments (name, type, description, status)
SELECT 'Barangay Tanod / Peace and Order', 'police',
       'Barangay peace and order team — theft, assault, disputes, scene security', 'active'
WHERE NOT EXISTS (SELECT 1 FROM public.departments WHERE name = 'Barangay Tanod / Peace and Order');

INSERT INTO public.departments (name, type, description, status)
SELECT 'Health and First Aid Team', 'medical',
       'Barangay health responders — first aid, medical emergencies, injury triage', 'active'
WHERE NOT EXISTS (SELECT 1 FROM public.departments WHERE name = 'Health and First Aid Team');

-- 2. Deactivate the legacy generic departments so auto-dispatch and the
--    assign pickers only offer the real barangay groups. Existing reports
--    keep their historical department reference (FK untouched).
UPDATE public.departments
SET status = 'inactive'
WHERE status IS DISTINCT FROM 'inactive'
  AND name IN (
    'Fire Department', 'Police Department', 'Emergency Medical Services',
    'Medical Services', 'Emergency Management'
  );

-- 3. auto_dispatch_assistance — report_type -> department types that respond
--    together, now matching the barangay response table. Status filter added
--    so deactivated departments never receive requests.
CREATE OR REPLACE FUNCTION public.auto_dispatch_assistance()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
    v_types public.department_type[];
BEGIN
    -- Reassignment cleanup first: stale pending auto-dispatch rows aimed at
    -- the OLD main department are cancelled.
    IF TG_OP = 'UPDATE'
       AND OLD.assigned_department_id IS DISTINCT FROM NEW.assigned_department_id
       AND OLD.assigned_department_id IS NOT NULL THEN
        UPDATE public.cross_department_assistance
        SET status = 'cancelled', updated_at = now()
        WHERE report_id = NEW.id
          AND notes = 'auto-dispatch'
          AND status = 'pending'
          AND assisting_department_id = OLD.assigned_department_id;
    END IF;

    -- New barangay incident types.
    v_types := CASE NEW.report_type::text
        WHEN 'flood'      THEN ARRAY['emergency_management']::public.department_type[]      -- DRT
        WHEN 'fire'       THEN ARRAY['emergency_management']::public.department_type[]      -- DRT (BFP is outside agency)
        WHEN 'theft'      THEN ARRAY['police']::public.department_type[]                    -- Tanod
        WHEN 'medical'    THEN ARRAY['medical']::public.department_type[]                   -- Health & First Aid
        WHEN 'accident'   THEN ARRAY['medical', 'police']::public.department_type[]         -- Health + Tanod
        WHEN 'assault'    THEN ARRAY['police', 'medical']::public.department_type[]         -- Tanod (+ Health if injured)
        WHEN 'structural' THEN ARRAY['emergency_management']::public.department_type[]      -- DRT
        -- Legacy type values still arriving from older clients.
        WHEN 'police'     THEN ARRAY['police']::public.department_type[]
        WHEN 'natural'    THEN ARRAY['emergency_management', 'medical', 'police']::public.department_type[]
        ELSE NULL
    END;

    IF v_types IS NULL THEN
        RETURN NEW;
    END IF;

    INSERT INTO public.cross_department_assistance
        (report_id, assisting_department_id, requested_by, notes)
    SELECT
        NEW.id,
        d.id,
        NEW.reporter_id,
        'auto-dispatch'
    FROM public.departments d
    WHERE d.type = ANY (v_types)
      AND (d.status IS NULL OR d.status = 'active')
      AND d.id IS DISTINCT FROM NEW.assigned_department_id
    ON CONFLICT (report_id, assisting_department_id) DO NOTHING;

    RETURN NEW;
END;
$$;

COMMIT;
