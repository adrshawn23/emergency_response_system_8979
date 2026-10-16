-- Operational workflows for Barangay Kalubihan.
-- This migration extends the starter schema with private documents, a versioned
-- service boundary, department memberships, assistance requests, and auditing.
-- Store document/media objects only in private Supabase Storage buckets.

DO $$ BEGIN
  CREATE TYPE public.registration_review_outcome AS ENUM ('likely_match', 'mismatch', 'unable_to_read', 'manual_review');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE public.assistance_status AS ENUM ('draft', 'sent', 'acknowledged', 'declined', 'cancelled', 'closed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE public.verification_response AS ENUM ('confirmed', 'cannot_verify', 'unverified');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS first_name text,
  ADD COLUMN IF NOT EXISTS middle_name text,
  ADD COLUMN IF NOT EXISTS last_name text,
  ADD COLUMN IF NOT EXISTS address text,
  ADD COLUMN IF NOT EXISTS birthdate date,
  ADD COLUMN IF NOT EXISTS account_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS approved_by uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL;

ALTER TABLE public.emergency_reports
  ADD COLUMN IF NOT EXISTS location_source text NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS location_accuracy numeric,
  ADD COLUMN IF NOT EXISTS service_area_status text NOT NULL DEFAULT 'inside',
  ADD COLUMN IF NOT EXISTS archived_at timestamptz;

CREATE TABLE IF NOT EXISTS public.service_boundaries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  boundary_geojson jsonb NOT NULL,
  buffer_meters integer NOT NULL DEFAULT 150 CHECK (buffer_meters >= 0),
  version integer NOT NULL DEFAULT 1,
  active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  archived_at timestamptz
);

CREATE TABLE IF NOT EXISTS public.registration_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  document_type text NOT NULL,
  private_storage_path text NOT NULL,
  uploaded_at timestamptz NOT NULL DEFAULT now(),
  ocr_name text,
  ocr_birthdate date,
  ocr_confidence numeric,
  comparison_outcome public.registration_review_outcome NOT NULL DEFAULT 'manual_review',
  reviewer_id uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  reviewer_decision text,
  reviewer_reason text,
  reviewed_at timestamptz,
  delete_after timestamptz,
  deleted_at timestamptz
);

CREATE TABLE IF NOT EXISTS public.department_access_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  permissions jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.department_memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  department_id uuid NOT NULL REFERENCES public.departments(id) ON DELETE RESTRICT,
  access_role_id uuid REFERENCES public.department_access_roles(id) ON DELETE SET NULL,
  on_duty boolean NOT NULL DEFAULT false,
  active boolean NOT NULL DEFAULT true,
  assigned_by uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, department_id)
);

CREATE TABLE IF NOT EXISTS public.emergency_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  description text,
  default_priority public.priority_level NOT NULL DEFAULT 'medium',
  routing_rules jsonb NOT NULL DEFAULT '{}'::jsonb,
  active boolean NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS public.incident_media (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id uuid NOT NULL REFERENCES public.emergency_reports(id) ON DELETE RESTRICT,
  private_storage_path text NOT NULL,
  media_type text NOT NULL,
  uploaded_by uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  uploaded_at timestamptz NOT NULL DEFAULT now(),
  delete_after timestamptz,
  deleted_at timestamptz
);

CREATE TABLE IF NOT EXISTS public.incident_verifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id uuid NOT NULL REFERENCES public.emergency_reports(id) ON DELETE CASCADE,
  verifier_id uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  response public.verification_response NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(incident_id, verifier_id)
);

CREATE TABLE IF NOT EXISTS public.incident_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id uuid NOT NULL REFERENCES public.emergency_reports(id) ON DELETE RESTRICT,
  department_id uuid NOT NULL REFERENCES public.departments(id) ON DELETE RESTRICT,
  responder_id uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  assignment_status text NOT NULL DEFAULT 'assigned',
  assigned_by uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz
);

CREATE TABLE IF NOT EXISTS public.department_assistance_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id uuid NOT NULL REFERENCES public.emergency_reports(id) ON DELETE RESTRICT,
  requesting_dispatcher_id uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE RESTRICT,
  target_department_id uuid NOT NULL REFERENCES public.departments(id) ON DELETE RESTRICT,
  request_text text NOT NULL,
  urgency public.priority_level NOT NULL,
  status public.assistance_status NOT NULL DEFAULT 'draft',
  sent_at timestamptz,
  acknowledged_at timestamptz,
  declined_reason text,
  closed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(incident_id, target_department_id, request_text, created_at)
);

CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  incident_id uuid REFERENCES public.emergency_reports(id) ON DELETE CASCADE,
  assistance_request_id uuid REFERENCES public.department_assistance_requests(id) ON DELETE CASCADE,
  channel text NOT NULL DEFAULT 'in_app',
  delivery_status text NOT NULL DEFAULT 'queued',
  sent_at timestamptz,
  read_at timestamptz,
  retry_count integer NOT NULL DEFAULT 0,
  failure_reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.incident_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id uuid NOT NULL REFERENCES public.emergency_reports(id) ON DELETE RESTRICT,
  actor_id uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  old_status text,
  new_status text NOT NULL,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  action text NOT NULL,
  record_type text NOT NULL,
  record_id uuid,
  old_value jsonb,
  new_value jsonb,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_assistance_incident ON public.department_assistance_requests(incident_id, status);
CREATE INDEX IF NOT EXISTS idx_notifications_recipient ON public.notifications(recipient_id, delivery_status);
CREATE INDEX IF NOT EXISTS idx_status_history_incident ON public.incident_status_history(incident_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_registration_documents_review ON public.registration_documents(comparison_outcome, reviewed_at);

-- Security helpers. Policy checks use the profile role, never mutable client claims.
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND role = 'admin') $$;

CREATE OR REPLACE FUNCTION public.is_dispatcher()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND role = 'dispatcher') $$;

ALTER TABLE public.service_boundaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.registration_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.department_access_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.department_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.emergency_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.incident_media ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.incident_verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.incident_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.department_assistance_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.incident_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "active_boundary_visible_to_authenticated" ON public.service_boundaries FOR SELECT TO authenticated USING (active OR public.is_admin());
CREATE POLICY "admins_manage_boundaries" ON public.service_boundaries FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "admins_review_private_documents" ON public.registration_documents FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "admins_manage_department_roles" ON public.department_access_roles FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "admins_manage_memberships" ON public.department_memberships FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "emergency_types_read" ON public.emergency_types FOR SELECT TO authenticated USING (active OR public.is_admin());
CREATE POLICY "admins_manage_emergency_types" ON public.emergency_types FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "staff_read_incident_media" ON public.incident_media FOR SELECT TO authenticated USING (public.is_admin() OR public.is_dispatcher() OR EXISTS (SELECT 1 FROM public.incident_assignments ia WHERE ia.incident_id = incident_media.incident_id AND ia.responder_id = auth.uid()));
CREATE POLICY "reporter_uploads_incident_media" ON public.incident_media FOR INSERT TO authenticated WITH CHECK (uploaded_by = auth.uid());
CREATE POLICY "eligible_users_verify_once" ON public.incident_verifications FOR INSERT TO authenticated WITH CHECK (verifier_id = auth.uid());
CREATE POLICY "users_read_own_verifications" ON public.incident_verifications FOR SELECT TO authenticated USING (verifier_id = auth.uid() OR public.is_dispatcher() OR public.is_admin());
CREATE POLICY "dispatchers_manage_assignments" ON public.incident_assignments FOR ALL TO authenticated USING (public.is_dispatcher() OR public.is_admin()) WITH CHECK (public.is_dispatcher() OR public.is_admin());
CREATE POLICY "staff_read_assistance" ON public.department_assistance_requests FOR SELECT TO authenticated USING (public.is_dispatcher() OR public.is_admin() OR EXISTS (SELECT 1 FROM public.department_memberships dm WHERE dm.department_id = department_assistance_requests.target_department_id AND dm.user_id = auth.uid() AND dm.active));
CREATE POLICY "dispatchers_create_assistance" ON public.department_assistance_requests FOR INSERT TO authenticated WITH CHECK (requesting_dispatcher_id = auth.uid() AND public.is_dispatcher());
CREATE POLICY "dispatchers_update_assistance" ON public.department_assistance_requests FOR UPDATE TO authenticated USING (public.is_dispatcher() OR public.is_admin()) WITH CHECK (public.is_dispatcher() OR public.is_admin());
CREATE POLICY "users_read_own_notifications" ON public.notifications FOR SELECT TO authenticated USING (recipient_id = auth.uid());
CREATE POLICY "staff_read_incident_history" ON public.incident_status_history FOR SELECT TO authenticated USING (public.is_dispatcher() OR public.is_admin() OR actor_id = auth.uid());
CREATE POLICY "admins_read_audit_logs" ON public.audit_logs FOR SELECT TO authenticated USING (public.is_admin());

-- Administrators alone can create or change department membership records.
REVOKE INSERT, UPDATE, DELETE ON public.department_memberships FROM authenticated;
GRANT SELECT ON public.department_memberships TO authenticated;
