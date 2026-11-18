-- Incident clusters — group corroborating reports of the same incident.
--
-- Two residents can report the same emergency within seconds of each other.
-- check_duplicate_incidents only warns in the composer; the second report
-- still inserts as an unrelated row, and truly simultaneous submits never
-- see each other at all (the RPC reads committed rows).
--
-- This migration adds cluster_id to emergency_reports and a trigger that
-- links every new report to an existing open report of the SAME TYPE within
-- 150m and 12h — the same radius/window as the composer warning. Because
-- Postgres serializes commits, whichever transaction commits second finds
-- the first's row and joins its cluster; a NULL cluster_id means the report
-- is standalone or the cluster's primary.
--
-- A second trigger propagates status/assignment changes from the cluster
-- primary to all linked members, so one dispatch covers every reporter
-- (each keeps their own row for notifications).
--
-- Apply via the Supabase SQL editor. Safe to re-run.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Column + index
-- ---------------------------------------------------------------------------

ALTER TABLE public.emergency_reports
  ADD COLUMN IF NOT EXISTS cluster_id uuid
  REFERENCES public.emergency_reports(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_emergency_reports_cluster_id
  ON public.emergency_reports (cluster_id)
  WHERE cluster_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 2. Link-on-insert trigger
-- ---------------------------------------------------------------------------
-- AFTER INSERT: NEW is already committed to the table snapshot, so exclude
-- it from the candidate search. Join the matched report's cluster — if the
-- match is itself a member, adopt its cluster_id; otherwise it becomes the
-- primary (cluster_id stays NULL on the primary).

CREATE OR REPLACE FUNCTION public.link_incident_cluster()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lat double precision;
  v_lng double precision;
  v_cluster uuid;
BEGIN
  -- Coordinates live in attachments jsonb (composer inserts them there).
  v_lat := (NEW.attachments->>'latitude')::double precision;
  v_lng := (NEW.attachments->>'longitude')::double precision;
  IF v_lat IS NULL OR v_lng IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(c.cluster_id, c.id) INTO v_cluster
  FROM (
    SELECT
      r.id,
      r.cluster_id,
      (
        6371000 * acos(
          least(1.0, greatest(-1.0,
            cos(radians(v_lat))
            * cos(radians((r.attachments->>'latitude')::double precision))
            * cos(
                radians((r.attachments->>'longitude')::double precision)
                - radians(v_lng)
              )
            + sin(radians(v_lat))
            * sin(radians((r.attachments->>'latitude')::double precision))
          ))
        )
      ) AS distance_m
    FROM public.emergency_reports r
    WHERE r.id <> NEW.id
      AND r.status IN ('pending', 'assigned', 'in-progress')
      AND r.report_type = NEW.report_type
      AND r.created_at > now() - interval '12 hours'
      AND r.attachments->>'latitude' IS NOT NULL
      AND r.attachments->>'longitude' IS NOT NULL
  ) c
  WHERE c.distance_m <= 150
  ORDER BY c.distance_m ASC
  LIMIT 1;

  IF v_cluster IS NOT NULL THEN
    UPDATE public.emergency_reports
    SET cluster_id = v_cluster
    WHERE id = NEW.id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_link_incident_cluster ON public.emergency_reports;
CREATE TRIGGER trg_link_incident_cluster
  AFTER INSERT ON public.emergency_reports
  FOR EACH ROW
  EXECUTE FUNCTION public.link_incident_cluster();

-- ---------------------------------------------------------------------------
-- 3. Propagation trigger — status/assignment flows primary -> members
-- ---------------------------------------------------------------------------
-- When any row in a cluster is assigned/accepted/declined/resolved, every
-- linked report gets the same values so all reporters are notified and no
-- member lingers as "pending" while responders are already dispatched.
-- pg_trigger_depth() = 1 prevents the cascade re-firing on member updates.

CREATE OR REPLACE FUNCTION public.propagate_cluster_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF pg_trigger_depth() > 1 THEN
    RETURN NEW;
  END IF;

  UPDATE public.emergency_reports
  SET
    status = NEW.status,
    assigned_to = NEW.assigned_to,
    assigned_department_id = NEW.assigned_department_id,
    resolved_at = NEW.resolved_at
  WHERE COALESCE(cluster_id, id) = COALESCE(NEW.cluster_id, NEW.id)
    AND id <> NEW.id
    AND (
      status IS DISTINCT FROM NEW.status
      OR assigned_to IS DISTINCT FROM NEW.assigned_to
      OR assigned_department_id IS DISTINCT FROM NEW.assigned_department_id
      OR resolved_at IS DISTINCT FROM NEW.resolved_at
    );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_propagate_cluster_update ON public.emergency_reports;
CREATE TRIGGER trg_propagate_cluster_update
  AFTER UPDATE OF status, assigned_to, assigned_department_id, resolved_at
  ON public.emergency_reports
  FOR EACH ROW
  EXECUTE FUNCTION public.propagate_cluster_update();

-- ---------------------------------------------------------------------------
-- 4. Expose cluster_id through the slim list view
-- ---------------------------------------------------------------------------
-- DROP + CREATE instead of CREATE OR REPLACE: the live view's column order
-- has drifted from the migration files, and OR REPLACE refuses to proceed
-- unless existing columns keep exact name+position. No other DB object
-- depends on this view, so a plain drop is safe (no CASCADE needed).

DROP VIEW IF EXISTS public.emergency_reports_list;

CREATE VIEW public.emergency_reports_list
WITH (security_invoker = on) AS
SELECT
    id,
    incident_id,
    reporter_id,
    cluster_id,
    report_type,
    content,
    created_at,
    updated_at,
    assigned_to,
    assigned_department_id,
    backup_responder_id,
    report_id,
    status,
    priority,
    resolved_at,
    (
        SELECT COALESCE(jsonb_object_agg(e.k, e.v), '{}'::jsonb)
        FROM jsonb_each(COALESCE(attachments, '{}'::jsonb)) AS e(k, v)
        WHERE octet_length(e.v::text) < 8192
    ) AS attachments
FROM public.emergency_reports;

GRANT SELECT ON public.emergency_reports_list TO authenticated;
GRANT SELECT ON public.emergency_reports_list TO anon;

COMMIT;
