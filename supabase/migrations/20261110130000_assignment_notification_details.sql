-- Assignment notification details + CDA responder-assignment notification.
-- Apply via the Supabase SQL editor (migrations are applied manually).
--
-- 1. notify_incident_assignment() — enrich the message/metadata with the
--    human report ref and location so recipients can tell which incident.
-- 2. notify_incident_status() — same enrichment on status notifications.
-- 3. notify_cda_assignment() — NEW trigger: department admins assigning a
--    responder to a cross-department assistance request now notify that
--    responder (this path previously produced no notification at all).

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Incident assignment → assigned responder, with incident ref + location.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.notify_incident_assignment()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_ref text;
  v_loc text;
BEGIN
  IF NEW.assigned_to IS NOT NULL
     AND NEW.assigned_to IS DISTINCT FROM OLD.assigned_to
     AND NEW.assigned_to IS DISTINCT FROM auth.uid() THEN
    v_ref := COALESCE(NEW.report_id::text, left(NEW.id::text, 8));
    v_loc := NULLIF(NEW.attachments->>'location', '');
    PERFORM public.create_notification(
      NEW.assigned_to, 'assignment',
      'New incident assignment',
      'You have been assigned a ' || COALESCE(NEW.report_type, 'emergency') || ' incident ('
        || v_ref || ')' || COALESCE(' at ' || v_loc, '') || '.',
      NEW.id,
      jsonb_build_object('report_id', NEW.id, 'report_ref', v_ref,
                         'report_type', NEW.report_type, 'location', v_loc));
  END IF;
  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- 2. Status notifications — include the report ref for identifiability.
--    (Keeps the ::text casts from 20261105020000_fix_notify_status_cast.sql.)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.notify_incident_status()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_ref text;
BEGIN
  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;

  v_ref := COALESCE(NEW.report_id::text, left(NEW.id::text, 8));

  IF NEW.reporter_id IS NOT NULL AND NEW.reporter_id IS DISTINCT FROM auth.uid() THEN
    PERFORM public.create_notification(
      NEW.reporter_id, 'incident_status',
      'Incident ' || REPLACE(NEW.status::text, '-', ' '),
      'Your ' || COALESCE(NEW.report_type, 'emergency') || ' report ('
        || v_ref || ') is now ' || REPLACE(NEW.status::text, '-', ' ') || '.',
      NEW.id, jsonb_build_object('report_id', NEW.id, 'report_ref', v_ref, 'status', NEW.status::text));
  END IF;

  IF NEW.assigned_to IS NOT NULL AND NEW.assigned_to IS DISTINCT FROM auth.uid()
     AND NEW.assigned_to IS DISTINCT FROM NEW.reporter_id THEN
    PERFORM public.create_notification(
      NEW.assigned_to, 'incident_status',
      'Incident ' || REPLACE(NEW.status::text, '-', ' '),
      'The ' || COALESCE(NEW.report_type, 'emergency') || ' incident assigned to you ('
        || v_ref || ') is now ' || REPLACE(NEW.status::text, '-', ' ') || '.',
      NEW.id, jsonb_build_object('report_id', NEW.id, 'report_ref', v_ref, 'status', NEW.status::text));
  END IF;
  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- 3. CDA responder assignment → the assigned responder.
--    Fires when a department admin picks a responder on an assistance row;
--    skipped when the actor assigns themselves.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.notify_cda_assignment()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_report public.emergency_reports%ROWTYPE;
  v_dept   text;
  v_ref    text;
  v_loc    text;
BEGIN
  IF NEW.responder_id IS NULL
     OR NEW.responder_id IS NOT DISTINCT FROM OLD.responder_id
     OR NEW.responder_id = auth.uid() THEN
    RETURN NEW;
  END IF;

  SELECT * INTO v_report FROM public.emergency_reports WHERE id = NEW.report_id;
  SELECT name INTO v_dept FROM public.departments WHERE id = NEW.assisting_department_id;
  v_ref := COALESCE(v_report.report_id::text, left(NEW.report_id::text, 8));
  v_loc := NULLIF(v_report.attachments->>'location', '');

  PERFORM public.create_notification(
    NEW.responder_id, 'assignment',
    'Assistance assignment',
    COALESCE(v_dept, 'A department') || ' assigned you to assist a '
      || COALESCE(v_report.report_type, 'emergency') || ' incident ('
      || v_ref || ')' || COALESCE(' at ' || v_loc, '') || '.',
    NEW.report_id,
    jsonb_build_object('report_id', NEW.report_id, 'cda_id', NEW.id,
      'report_ref', v_ref, 'report_type', v_report.report_type,
      'location', v_loc, 'department', v_dept));
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_cda_assignment ON public.cross_department_assistance;
CREATE TRIGGER trg_notify_cda_assignment
  AFTER UPDATE OF responder_id ON public.cross_department_assistance
  FOR EACH ROW EXECUTE FUNCTION public.notify_cda_assignment();

COMMIT;
