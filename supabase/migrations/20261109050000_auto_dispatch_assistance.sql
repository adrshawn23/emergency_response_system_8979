-- Automatic dispatch assistance.
-- Every new emergency report immediately creates cross_department_assistance
-- rows for the departments its incident type requires — the same rows the
-- manual "Request assistance" modal produces, minus the click. Targeted
-- departments see the request in their responder view and accept/decline.
--
-- Apply via Supabase SQL editor (migrations are applied manually).
--
-- requested_by = the reporter: the column is NOT NULL and the reporter is
-- the person who effectively triggered the request. Rows are marked with
-- notes = 'auto-dispatch' so the UI can badge them as automatic.

BEGIN;

CREATE OR REPLACE FUNCTION public.auto_dispatch_assistance()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
    v_types public.department_type[];
BEGIN
    -- incident_type -> department types that respond together.
    v_types := CASE NEW.incident_type::text
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

DROP TRIGGER IF EXISTS trg_auto_dispatch_assistance ON public.emergency_reports;
CREATE TRIGGER trg_auto_dispatch_assistance
    AFTER INSERT ON public.emergency_reports
    FOR EACH ROW EXECUTE FUNCTION public.auto_dispatch_assistance();

COMMIT;
