-- Arrival backfill on resolve.
--
-- Problem: "Arrived" is recorded only by mark_incident_arrived /
-- mark_incident_arrived_manual. When the GPS-verified RPC rejects the tap
-- (too_far, location_unavailable) or the responder skips straight to
-- Resolve, the incident ends resolved with NO arrived row — the timeline
-- then shows "Arrived — not recorded", which reads like a failure even
-- though the unit demonstrably reached the scene (they resolved it).
--
-- Fix: when a report transitions to 'resolved' without an arrived row,
-- the status trigger inserts one marked meta.method='inferred' so the
-- timeline renders a completed Arrived step. The one-time UPDATE below
-- repairs incidents already resolved this way (timestamp = resolved time
-- so ordering stays correct; meta records it was inferred, not GPS).
--
-- Apply via Supabase SQL editor.

BEGIN;

-- 1. Trigger: resolving without a recorded arrival infers arrival ----------
CREATE OR REPLACE FUNCTION public.log_incident_status_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
    IF OLD.status IS DISTINCT FROM NEW.status THEN
        -- Resolution implies the unit was on scene. If no arrival was
        -- recorded (GPS reject / skipped tap), synthesize the hop so the
        -- canonical chain stays truthful about ordering.
        IF NEW.status = 'resolved' AND NOT EXISTS (
            SELECT 1 FROM public.incident_status_history
            WHERE report_id = NEW.id AND to_status = 'arrived'
        ) THEN
            INSERT INTO public.incident_status_history
                (report_id, from_status, to_status, actor_id, meta, created_at)
            VALUES (NEW.id, 'in-progress', 'arrived', auth.uid(),
                    jsonb_build_object('method', 'inferred',
                                       'note', 'resolved without an explicit arrival mark'),
                    now() - interval '1 second');
        END IF;

        INSERT INTO public.incident_status_history (report_id, from_status, to_status, actor_id)
        VALUES (NEW.id, OLD.status::text, NEW.status::text, auth.uid());
    END IF;
    RETURN NEW;
END;
$$;

-- 2. One-time repair for incidents already resolved without arrival --------
INSERT INTO public.incident_status_history
    (report_id, from_status, to_status, actor_id, meta, created_at)
SELECT
    er.id,
    'in-progress',
    'arrived',
    er.assigned_to,
    jsonb_build_object('method', 'inferred',
                       'note', 'backfilled — resolved without an explicit arrival mark'),
    COALESCE(er.resolved_at, er.updated_at, now()) - interval '1 second'
FROM public.emergency_reports er
WHERE er.status = 'resolved'
  AND NOT EXISTS (
      SELECT 1 FROM public.incident_status_history ish
      WHERE ish.report_id = er.id AND ish.to_status = 'arrived'
  );

COMMIT;
