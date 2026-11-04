-- Incident-scoped messaging between the reporter (resident) and the
-- assigned responder. Thread exists only once a responder is assigned —
-- dispatch coordinates pre-assignment via the existing workflows.
-- Apply via the Supabase SQL editor; supabase CLI is not linked here.

-- Role helpers — defined here so this migration is self-contained (the
-- operational_workflows migration that first introduced them is not applied
-- on the live project).
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND role = 'admin') $$;

CREATE OR REPLACE FUNCTION public.is_dispatcher()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND role = 'dispatcher') $$;

CREATE TABLE IF NOT EXISTS public.incident_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id uuid NOT NULL REFERENCES public.emergency_reports(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  body text NOT NULL CHECK (char_length(btrim(body)) > 0 AND char_length(body) <= 2000),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_incident_messages_report
  ON public.incident_messages(report_id, created_at);

ALTER TABLE public.incident_messages ENABLE ROW LEVEL SECURITY;

-- The two parties on the incident can read the thread; dispatch/admin read
-- for oversight and dispute resolution.
DROP POLICY IF EXISTS incident_participants_read ON public.incident_messages;
CREATE POLICY "incident_participants_read" ON public.incident_messages
FOR SELECT TO authenticated
USING (
  public.is_admin() OR public.is_dispatcher()
  OR EXISTS (
    SELECT 1 FROM public.emergency_reports r
    WHERE r.id = incident_messages.report_id
      AND (r.reporter_id::text = auth.uid()::text OR r.assigned_to::text = auth.uid()::text)
  )
);

-- Only the reporter and the assigned responder can post, and only while the
-- incident actually has a responder assigned. sender_id is pinned to the
-- caller so messages cannot be forged for another user.
DROP POLICY IF EXISTS incident_participants_write ON public.incident_messages;
CREATE POLICY "incident_participants_write" ON public.incident_messages
FOR INSERT TO authenticated
WITH CHECK (
  sender_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.emergency_reports r
    WHERE r.id = report_id
      AND r.assigned_to IS NOT NULL
      AND (r.reporter_id::text = auth.uid()::text OR r.assigned_to::text = auth.uid()::text)
  )
);

-- Deliver new messages over Supabase Realtime (idempotent).
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.incident_messages;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_object THEN NULL;
END $$;
