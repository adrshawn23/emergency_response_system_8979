-- D-16 CRITICAL schema drift: the live departments table has NO type
-- column, but auto_dispatch_assistance() maps incidents to departments via
-- `d.type = ANY(v_types)`. Every dispatch write (dispatcher assigning the
-- main department) currently throws "column d.type does not exist" and the
-- whole UPDATE rolls back — auto-dispatch never runs.
--
-- The column exists in the original schema file
-- (20250105014120_emergency_response_system.sql:54) but was never applied to
-- this DB — the live table grew a different shape (parent_department_id,
-- status, permissions).
--
-- 1) Add the column (nullable: untyped departments simply never receive
--    auto-dispatch requests — the trigger skips them).
-- 2) Backfill by name so existing departments start participating.
-- 3) The Create Department UI now sends type for new rows.
--
-- Apply via Supabase SQL editor.

BEGIN;

ALTER TABLE public.departments
    ADD COLUMN IF NOT EXISTS type public.department_type;

-- Name-based backfill. Review afterwards:
--   SELECT id, name, type FROM public.departments ORDER BY name;
UPDATE public.departments SET type = 'fire'
    WHERE type IS NULL AND lower(name) ~ '(fire|brigade|bfp)';

UPDATE public.departments SET type = 'medical'
    WHERE type IS NULL AND lower(name) ~ '(medic|ems|ambulance|health|hospital|rescue)';

UPDATE public.departments SET type = 'police'
    WHERE type IS NULL AND lower(name) ~ '(police|pnp|safety|security|law|peace)';

UPDATE public.departments SET type = 'emergency_management'
    WHERE type IS NULL AND lower(name) ~ '(management|drrmo|drrm|disaster|coordinat|command)';

COMMIT;
