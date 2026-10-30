-- Server-side verification enforcement.
--
-- What this changes, and why:
--   * id_verifications gets review-revision columns and a 'correction_required'
--     plus 'superseded' status. The legacy CHECK is replaced defensively.
--   * Clients can NEVER write decision fields or OCR results — a BEFORE INSERT
--     trigger strips them unless the call comes from a service/edge context
--     (auth.uid() IS NULL). Browser-supplied OCR is untrusted by policy.
--   * review_verification() is the ONLY approval path: atomic decision +
--     activation + audit row, guarded against superseded submissions and
--     non-admin callers.
--   * Resubmission supersedes older open submissions; a non-admin identity
--     edit (name/address/birthdate) invalidates prior approval.
--   * Self-service UPDATE on user_profiles cannot touch role, status,
--     account_status, or department_id.
--   * Pending residents cannot create incident reports (server-side, not UI).
--   * audit_logs columns are reconciled across the two conflicting historical
--     definitions (20261016 actor_id/record_type vs 20261019 user_id/table_name)
--     by ensuring the union of columns exists and populating both.

-- ---------------------------------------------------------------------------
-- 1. Schema reconciliation
-- ---------------------------------------------------------------------------
ALTER TABLE public.id_verifications
  ADD COLUMN IF NOT EXISTS submission_revision integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS decision_reason text,
  ADD COLUMN IF NOT EXISTS decision_at timestamptz,
  ADD COLUMN IF NOT EXISTS policy_version text,
  ADD COLUMN IF NOT EXISTS document_storage_path text;

ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS approved_by uuid;

-- audit_logs union columns (the two historical definitions disagree).
ALTER TABLE public.audit_logs
  ADD COLUMN IF NOT EXISTS actor_id uuid,
  ADD COLUMN IF NOT EXISTS record_type text,
  ADD COLUMN IF NOT EXISTS old_value jsonb,
  ADD COLUMN IF NOT EXISTS new_value jsonb,
  ADD COLUMN IF NOT EXISTS reason text,
  ADD COLUMN IF NOT EXISTS user_id uuid,
  ADD COLUMN IF NOT EXISTS table_name text,
  ADD COLUMN IF NOT EXISTS record_id uuid,
  ADD COLUMN IF NOT EXISTS old_values jsonb,
  ADD COLUMN IF NOT EXISTS new_values jsonb;

-- Extend the verification_status CHECK with the new states. The historical
-- CHECK excluded 'correction_required' and 'superseded'.
DO $$
DECLARE
  cname text;
BEGIN
  SELECT conname INTO cname
  FROM pg_constraint
  WHERE conrelid = 'public.id_verifications'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) ILIKE '%verification_status%'
  LIMIT 1;

  IF cname IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.id_verifications DROP CONSTRAINT %I', cname);
  END IF;

  ALTER TABLE public.id_verifications
    ADD CONSTRAINT id_verifications_status_check
    CHECK (verification_status IN (
      'pending', 'under_review', 'approved', 'rejected',
      'needs_clarity', 'correction_required', 'superseded'
    ));
END $$;

-- ---------------------------------------------------------------------------
-- 2. Client inserts may not carry decisions or OCR
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.guard_verification_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NOT NULL THEN
    -- A browser call: nothing the client sent about OCR or decisions is
    -- trusted. The edge function (service role, auth.uid() IS NULL) bypasses
    -- this strip and writes server-produced OCR fields.
    NEW.verification_status := 'pending';
    NEW.reviewed_by := NULL;
    NEW.review_notes := NULL;
    NEW.decision_reason := NULL;
    NEW.decision_at := NULL;
    NEW.ocr_data := NULL;
    NEW.ocr_confidence := NULL;
    NEW.user_id := auth.uid();          -- cannot submit for someone else
  END IF;

  -- Revision tracking + supersede any earlier open/decided submission.
  NEW.submission_revision := COALESCE(
    (SELECT max(submission_revision) + 1
       FROM public.id_verifications
      WHERE user_id = NEW.user_id), 1);

  UPDATE public.id_verifications
  SET verification_status = 'superseded', decision_at = now()
  WHERE user_id = NEW.user_id
    AND id IS DISTINCT FROM NEW.id
    AND verification_status IN ('pending', 'under_review', 'needs_clarity', 'correction_required', 'approved');

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_verification_insert ON public.id_verifications;
CREATE TRIGGER trg_guard_verification_insert
  BEFORE INSERT ON public.id_verifications
  FOR EACH ROW EXECUTE FUNCTION public.guard_verification_insert();

-- Also block client-side status tampering on existing rows: only the server
-- or review_verification() may move a row out of 'pending'/'under_review'.
CREATE OR REPLACE FUNCTION public.guard_verification_update()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'verification decisions are administrator-only';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_verification_update ON public.id_verifications;
CREATE TRIGGER trg_guard_verification_update
  BEFORE UPDATE ON public.id_verifications
  FOR EACH ROW EXECUTE FUNCTION public.guard_verification_update();

-- ---------------------------------------------------------------------------
-- 3. Self-update guard + approval invalidation on identity change
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.guard_profile_self_update()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF auth.uid() = NEW.id AND NOT public.is_admin() THEN
    -- Users cannot change their own privilege/account gate columns.
    NEW.role := OLD.role;
    NEW.status := OLD.status;
    NEW.account_status := OLD.account_status;
    NEW.department_id := OLD.department_id;

    -- Identity/residency edits invalidate prior approval → re-review.
    IF (NEW.first_name IS DISTINCT FROM OLD.first_name)
       OR (NEW.last_name IS DISTINCT FROM OLD.last_name)
       OR (NEW.birthdate IS DISTINCT FROM OLD.birthdate)
       OR (NEW.address IS DISTINCT FROM OLD.address) THEN
      NEW.account_status := 'pending';
      NEW.status := 'inactive';
      UPDATE public.id_verifications
      SET verification_status = 'superseded', decision_at = now()
      WHERE user_id = NEW.id
        AND verification_status IN ('approved', 'pending', 'under_review');
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_profile_self_update ON public.user_profiles;
CREATE TRIGGER trg_guard_profile_self_update
  BEFORE UPDATE ON public.user_profiles
  FOR EACH ROW EXECUTE FUNCTION public.guard_profile_self_update();

-- ---------------------------------------------------------------------------
-- 4. Atomic admin review — the ONLY approval path
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.review_verification(
  p_verification_id uuid,
  p_decision text,
  p_reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_row public.id_verifications%ROWTYPE;
  v_policy_version text := 'verify-1.0';
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'administrator role required';
  END IF;

  IF p_decision NOT IN ('approved', 'rejected', 'needs_clarity', 'correction_required') THEN
    RAISE EXCEPTION 'invalid decision %', p_decision;
  END IF;

  IF p_decision <> 'approved' AND (p_reason IS NULL OR btrim(p_reason) = '') THEN
    RAISE EXCEPTION 'a specific reason is required for %', p_decision;
  END IF;

  SELECT * INTO v_row
  FROM public.id_verifications
  WHERE id = p_verification_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'verification % not found', p_verification_id;
  END IF;

  IF v_row.verification_status = 'superseded' THEN
    RAISE EXCEPTION 'submission revision % was superseded — review the current submission instead', v_row.submission_revision;
  END IF;

  UPDATE public.id_verifications
  SET verification_status = p_decision,
      reviewed_by = auth.uid(),
      review_notes = p_reason,
      decision_reason = p_reason,
      decision_at = now(),
      policy_version = v_policy_version
  WHERE id = v_row.id;

  IF p_decision = 'approved' THEN
    UPDATE public.user_profiles
    SET status = 'active',
        account_status = 'active',
        approved_at = now(),
        approved_by = auth.uid()
    WHERE id = v_row.user_id;
  END IF;

  INSERT INTO public.audit_logs (
    actor_id, user_id, action, record_type, table_name, record_id,
    old_value, new_value, old_values, new_values, reason, created_at
  ) VALUES (
    auth.uid(), auth.uid(), 'review_' || p_decision,
    'id_verifications', 'id_verifications', v_row.id,
    to_jsonb(v_row), NULL,
    to_jsonb(v_row), NULL,
    p_reason, now()
  );

  RETURN jsonb_build_object(
    'verification_id', v_row.id,
    'user_id', v_row.user_id,
    'decision', p_decision,
    'revision', v_row.submission_revision
  );
END;
$$;

REVOKE ALL ON FUNCTION public.review_verification(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.review_verification(uuid, text, text) TO authenticated;

-- ---------------------------------------------------------------------------
-- 5. Pending residents cannot file reports (server-side gate)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.caller_can_report()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE id = auth.uid()
      AND (
        role IN ('dispatcher', 'responder', 'admin')
        OR (role = 'resident' AND COALESCE(account_status, 'pending') = 'active')
      )
  );
$$;

-- Replace every existing INSERT policy on emergency_reports with the gated
-- one. Policies are permissive (OR'd), so the old permissive policy MUST go.
DO $$
DECLARE
  p record;
BEGIN
  FOR p IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'emergency_reports' AND cmd = 'INSERT'
  LOOP
    EXECUTE format('DROP POLICY %I ON public.emergency_reports', p.policyname);
  END LOOP;
END $$;

CREATE POLICY "active_accounts_insert_reports" ON public.emergency_reports
  FOR INSERT TO authenticated
  WITH CHECK (reporter_id = auth.uid() AND public.caller_can_report());
