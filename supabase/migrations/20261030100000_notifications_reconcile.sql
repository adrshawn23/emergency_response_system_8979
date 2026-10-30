-- Reconcile notifications for real client use.
--
-- The historical migration (20261016090000) created public.notifications with
-- delivery plumbing but no title/message content and no write policies, so no
-- client could ever populate or read it usefully. This migration:
--   1. Adds content columns (type/title/message/metadata).
--   2. Keeps SELECT-own policy; routes ALL writes through SECURITY DEFINER
--      helpers (users may only mark their own rows read; only server
--      triggers/functions may insert).
--   3. Wires trigger-driven notifications for the real workflows.
--   4. Enables realtime on the table.
--
-- Safe to re-run; everything is guarded.

-- ---------------------------------------------------------------------------
-- 1. Content columns
-- ---------------------------------------------------------------------------
ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS type text NOT NULL DEFAULT 'info',
  ADD COLUMN IF NOT EXISTS title text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS message text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_notifications_recipient_unread
  ON public.notifications (recipient_id, created_at DESC)
  WHERE read_at IS NULL;

-- ---------------------------------------------------------------------------
-- 2. Read/write helpers — the ONLY mutation path for recipients
-- ---------------------------------------------------------------------------

-- Insert a notification. SECURITY DEFINER so triggers and server code can
-- write regardless of the caller; direct client INSERT stays impossible
-- (no INSERT policy is ever granted).
CREATE OR REPLACE FUNCTION public.create_notification(
  p_recipient_id uuid,
  p_type text,
  p_title text,
  p_message text,
  p_incident_id uuid DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  INSERT INTO public.notifications (recipient_id, type, title, message, incident_id, metadata, delivery_status)
  VALUES (p_recipient_id, p_type, p_title, p_message, p_incident_id, p_metadata, 'sent')
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

-- Mark specific notifications read — recipient-owned rows only.
CREATE OR REPLACE FUNCTION public.mark_notifications_read(p_ids uuid[])
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  UPDATE public.notifications
  SET read_at = now()
  WHERE id = ANY(p_ids)
    AND recipient_id = auth.uid()
    AND read_at IS NULL;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- Mark every unread notification for the caller read.
CREATE OR REPLACE FUNCTION public.mark_all_notifications_read()
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  UPDATE public.notifications
  SET read_at = now()
  WHERE recipient_id = auth.uid()
    AND read_at IS NULL;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.mark_notifications_read(uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_all_notifications_read() TO authenticated;
-- create_notification is intentionally NOT granted to authenticated.

-- Recipients must not UPDATE rows directly (could forge read state of others
-- or rewrite content). Drop any legacy permissive policies, keep select-own.
DROP POLICY IF EXISTS "users_update_own_notifications" ON public.notifications;
DROP POLICY IF EXISTS "users_insert_notifications" ON public.notifications;
DROP POLICY IF EXISTS "users_read_own_notifications" ON public.notifications;
CREATE POLICY "users_read_own_notifications" ON public.notifications
  FOR SELECT TO authenticated USING (recipient_id = auth.uid());

-- ---------------------------------------------------------------------------
-- 3. Workflow triggers
-- ---------------------------------------------------------------------------

-- New incident → dispatchers and admins.
CREATE OR REPLACE FUNCTION public.notify_new_incident()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.notifications (recipient_id, type, title, message, incident_id, metadata, delivery_status)
  SELECT p.id, 'new_incident',
         'New incident reported',
         'A ' || COALESCE(NEW.report_type, 'emergency') || ' report needs triage.',
         NEW.id,
         jsonb_build_object('report_id', NEW.id, 'report_type', NEW.report_type),
         'sent'
  FROM public.user_profiles p
  WHERE p.role IN ('dispatcher', 'admin')
    AND p.account_status IS DISTINCT FROM 'suspended';
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_new_incident ON public.emergency_reports;
CREATE TRIGGER trg_notify_new_incident
  AFTER INSERT ON public.emergency_reports
  FOR EACH ROW EXECUTE FUNCTION public.notify_new_incident();

-- Status change → reporter and assigned responder (no self-notification to
-- the actor making the change).
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
      'Incident ' || REPLACE(NEW.status, '-', ' '),
      'Your ' || COALESCE(NEW.report_type, 'emergency') || ' report is now ' || REPLACE(NEW.status, '-', ' ') || '.',
      NEW.id, jsonb_build_object('report_id', NEW.id, 'status', NEW.status));
  END IF;

  IF NEW.assigned_to IS NOT NULL AND NEW.assigned_to IS DISTINCT FROM auth.uid()
     AND NEW.assigned_to IS DISTINCT FROM NEW.reporter_id THEN
    PERFORM public.create_notification(
      NEW.assigned_to, 'incident_status',
      'Incident ' || REPLACE(NEW.status, '-', ' '),
      'An incident assigned to you is now ' || REPLACE(NEW.status, '-', ' ') || '.',
      NEW.id, jsonb_build_object('report_id', NEW.id, 'status', NEW.status));
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_incident_status ON public.emergency_reports;
CREATE TRIGGER trg_notify_incident_status
  AFTER UPDATE ON public.emergency_reports
  FOR EACH ROW EXECUTE FUNCTION public.notify_incident_status();

-- Assignment → the responder being assigned.
CREATE OR REPLACE FUNCTION public.notify_incident_assignment()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NEW.assigned_to IS NOT NULL
     AND NEW.assigned_to IS DISTINCT FROM OLD.assigned_to
     AND NEW.assigned_to IS DISTINCT FROM auth.uid() THEN
    PERFORM public.create_notification(
      NEW.assigned_to, 'assignment',
      'New incident assignment',
      'You have been assigned a ' || COALESCE(NEW.report_type, 'emergency') || ' incident.',
      NEW.id, jsonb_build_object('report_id', NEW.id));
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_incident_assignment ON public.emergency_reports;
CREATE TRIGGER trg_notify_incident_assignment
  AFTER UPDATE ON public.emergency_reports
  FOR EACH ROW EXECUTE FUNCTION public.notify_incident_assignment();

-- Verification decision → the applicant. Never includes ID data or OCR text.
CREATE OR REPLACE FUNCTION public.notify_verification_decision()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NEW.verification_status IS DISTINCT FROM OLD.verification_status
     AND NEW.verification_status IN ('approved', 'rejected', 'needs_clarity', 'correction_required') THEN
    PERFORM public.create_notification(
      NEW.user_id, 'verification_decision',
      CASE NEW.verification_status
        WHEN 'approved' THEN 'Registration approved'
        WHEN 'rejected' THEN 'Registration update'
        ELSE 'Registration needs attention'
      END,
      CASE NEW.verification_status
        WHEN 'approved' THEN 'Your residency verification was approved. Your account is now active.'
        WHEN 'rejected' THEN 'Your registration could not be approved. See your account for details and how to appeal.'
        ELSE 'The review team needs more information about your registration. Open your account to see what to correct or resubmit.'
      END,
      NULL, jsonb_build_object('verification_id', NEW.id, 'status', NEW.verification_status));
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_verification_decision ON public.id_verifications;
CREATE TRIGGER trg_notify_verification_decision
  AFTER UPDATE ON public.id_verifications
  FOR EACH ROW EXECUTE FUNCTION public.notify_verification_decision();

-- New pending registration → admins.
CREATE OR REPLACE FUNCTION public.notify_pending_registration()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NEW.role = 'resident' AND (NEW.account_status IS NULL OR NEW.account_status = 'pending') THEN
    INSERT INTO public.notifications (recipient_id, type, title, message, metadata, delivery_status)
    SELECT p.id, 'pending_registration',
           'New registration to review',
           COALESCE(NEW.full_name, NEW.email, 'A resident') || ' is awaiting ID review.',
           jsonb_build_object('user_id', NEW.id),
           'sent'
    FROM public.user_profiles p
    WHERE p.role = 'admin';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_pending_registration ON public.user_profiles;
CREATE TRIGGER trg_notify_pending_registration
  AFTER INSERT ON public.user_profiles
  FOR EACH ROW EXECUTE FUNCTION public.notify_pending_registration();

-- ---------------------------------------------------------------------------
-- 4. Realtime
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime')
     AND NOT EXISTS (
       SELECT 1 FROM pg_publication_tables
       WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'notifications'
     ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Could not add notifications to realtime publication: %', SQLERRM;
END $$;
