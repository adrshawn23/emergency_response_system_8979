-- D-17 CRITICAL schema drift (sibling of D-16): auto_dispatch_assistance()
-- reads NEW.incident_type, but the live emergency_reports column is
-- report_type (what the app writes: `report_type: draft.type`). Every
-- dispatch write fails with 42703 `record "new" has no field
-- "incident_type"` and rolls back the dispatcher's UPDATE.
--
-- Found by e2e/department_dispatch.spec.js after D-16 was applied — the
-- type-column error masked this one.
--
-- Apply via Supabase SQL editor.

BEGIN;

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

    -- report_type -> department types that respond together.
    v_types := CASE NEW.report_type::text
        WHEN 'fire'     THEN ARRAY['fire', 'medical', 'police']::public.department_type[]
        WHEN 'medical'  THEN ARRAY['medical']::public.department_type[]
        WHEN 'police'   THEN ARRAY['police']::public.department_type[]
        WHEN 'accident' THEN ARRAY['medical', 'police']::public.department_type[]
        WHEN 'natural'  THEN ARRAY['fire', 'medical', 'police', 'emergency_management']::public.department_type[]
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
      AND d.id IS DISTINCT FROM NEW.assigned_department_id
    ON CONFLICT (report_id, assisting_department_id) DO NOTHING;

    RETURN NEW;
END;
$$;

COMMIT;
