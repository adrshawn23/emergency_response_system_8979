-- Resident photo evidence, enforced at the database (audit F-03, constitution I).
--
-- Problem: the >=1-photo requirement for resident incident reports exists only
-- in React (fa846c9). A resident can call PostgREST directly and insert a
-- report with no attachments.images — client validation is bypassable.
--
-- This trigger rejects the INSERT when the reporter's profile role is
-- 'resident' and the row carries no photo evidence. Staff roles
-- (dispatcher/responder/admin) stay photo-optional — phone-reported incidents.
-- images must be a non-empty JSON array (the app stores data-URL strings).
--
-- Apply in the Supabase SQL editor. Safe to re-run.

CREATE OR REPLACE FUNCTION public.enforce_resident_photo_evidence()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text;
BEGIN
  SELECT role INTO v_role
  FROM public.user_profiles
  WHERE id = NEW.reporter_id;

  IF v_role = 'resident'
     AND COALESCE(jsonb_array_length(
           CASE jsonb_typeof(NEW.attachments->'images')
             WHEN 'array' THEN NEW.attachments->'images'
             ELSE '[]'::jsonb
           END), 0) = 0
  THEN
    RAISE EXCEPTION 'Residents must attach at least one photo as evidence.'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_resident_photo_evidence ON public.emergency_reports;
CREATE TRIGGER trg_resident_photo_evidence
  BEFORE INSERT ON public.emergency_reports
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_resident_photo_evidence();
