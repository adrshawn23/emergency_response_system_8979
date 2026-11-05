-- Fix: assigning an incident fails with
--   function replace(report_status, unknown, unknown) does not exist
--
-- notify_incident_status() calls REPLACE(NEW.status, '-', ' ') where status
-- is the report_status ENUM. There is no replace() overload for enums, so
-- Postgres raises 42883 and the whole emergency_reports UPDATE is aborted
-- (the dispatcher sees "Assignment error").
--
-- This patches the live function with NEW.status::text casts. The existing
-- trg_notify_incident_status trigger already points at this function, so
-- CREATE OR REPLACE is all that's needed. Run once in the SQL editor.

CREATE OR REPLACE FUNCTION public.notify_incident_status()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;

  IF NEW.reporter_id IS NOT NULL AND NEW.reporter_id IS DISTINCT FROM auth.uid() THEN
    PERFORM public.create_notification(
      NEW.reporter_id, 'incident_status',
      'Incident ' || REPLACE(NEW.status::text, '-', ' '),
      'Your ' || COALESCE(NEW.report_type, 'emergency') || ' report is now ' || REPLACE(NEW.status::text, '-', ' ') || '.',
      NEW.id, jsonb_build_object('report_id', NEW.id, 'status', NEW.status));
  END IF;

  IF NEW.assigned_to IS NOT NULL AND NEW.assigned_to IS DISTINCT FROM auth.uid()
     AND NEW.assigned_to IS DISTINCT FROM NEW.reporter_id THEN
    PERFORM public.create_notification(
      NEW.assigned_to, 'incident_status',
      'Incident ' || REPLACE(NEW.status::text, '-', ' '),
      'An incident assigned to you is now ' || REPLACE(NEW.status::text, '-', ' ') || '.',
      NEW.id, jsonb_build_object('report_id', NEW.id, 'status', NEW.status));
  END IF;
  RETURN NEW;
END;
$$;
