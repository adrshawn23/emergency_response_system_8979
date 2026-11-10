-- Verification decision → in-app notification + realtime on id_verifications.
-- Apply via the Supabase SQL editor (migrations are applied manually).
--
-- 1. notify_verification_decision() — when review_verification() (or the UI
--    fallback / auto-reject cron) moves a submission to a non-approved
--    decision state, the registrant gets a notifications row carrying the
--    reviewer's reason. Approved rows need none — the account activates and
--    the verification card disappears; email still goes via notify-decision.
-- 2. id_verifications joins supabase_realtime so the Residents & review
--    status tabs re-derive counts live (spec 003 FR-009).

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Decision notification trigger
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.notify_verification_decision()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  -- Only fire on an actual status change into a decision needing attention.
  IF NEW.verification_status IS NOT DISTINCT FROM OLD.verification_status
     OR NEW.verification_status NOT IN ('needs_clarity', 'correction_required', 'rejected') THEN
    RETURN NEW;
  END IF;

  PERFORM public.create_notification(
    NEW.user_id,
    'verification_decision',
    CASE NEW.verification_status
      WHEN 'rejected' THEN 'Registration not approved'
      ELSE 'ID verification — action needed'
    END,
    CASE NEW.verification_status
      WHEN 'needs_clarity'        THEN 'Your ID photo was not clear enough. ' || COALESCE(NEW.decision_reason, NEW.review_notes, 'Please re-upload a sharper, well-lit photo.')
      WHEN 'correction_required'  THEN 'Your ID details need correction. ' || COALESCE(NEW.decision_reason, NEW.review_notes, 'Please resubmit a document matching your registration.')
      ELSE COALESCE(NEW.decision_reason, NEW.review_notes, 'Your registration could not be approved. You may resubmit or contact the barangay office to appeal.')
    END,
    NULL,
    jsonb_build_object(
      'verification_id', NEW.id,
      'verification_status', NEW.verification_status,
      'submission_revision', NEW.submission_revision,
      'action_url', '/'
    ));
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_verification_decision ON public.id_verifications;
CREATE TRIGGER trg_notify_verification_decision
  AFTER UPDATE OF verification_status ON public.id_verifications
  FOR EACH ROW EXECUTE FUNCTION public.notify_verification_decision();

-- ---------------------------------------------------------------------------
-- 2. Realtime publication — status tabs live-derive counts (FR-009)
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime')
     AND NOT EXISTS (
       SELECT 1 FROM pg_publication_tables
       WHERE pubname = 'supabase_realtime' AND tablename = 'id_verifications'
     ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.id_verifications;
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Could not add id_verifications to realtime publication: %', SQLERRM;
END $$;

COMMIT;
