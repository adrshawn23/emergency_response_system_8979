-- Geofence enforcement — resident reports whose GPS fix lands outside the
-- active service boundary are rejected outright.
--
-- The UI already computes service_area_status ('inside'/'outside'/'manual')
-- but only as a badge; this trigger makes the boundary a hard rule so a
-- report cannot "still go through" when its coordinates are verifiably
-- outside Barangay Kalubihan.
--
-- Scope mirrors the app rule: RESIDENTS only — dispatchers/responders/admins
-- may file for incidents anywhere. Reports without coordinates, or when no
-- active boundary exists, fall back to manual triage (allowed, status
-- 'manual'), matching the composer's unverifiable case.

BEGIN;

CREATE OR REPLACE FUNCTION public.enforce_service_area()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role     text;
  v_lat      double precision;
  v_lng      double precision;
  v_points   jsonb;
  v_count    int;
  v_inside   boolean := false;
  i          int;
  j          int;
  xi         double precision;
  yi         double precision;
  xj         double precision;
  yj         double precision;
BEGIN
  -- Staff file reports without boundary checks.
  SELECT role INTO v_role FROM public.user_profiles WHERE id = NEW.reporter_id;
  IF v_role IS DISTINCT FROM 'resident' THEN
    RETURN NEW;
  END IF;

  -- No coordinates -> manual triage path stays allowed.
  BEGIN
    v_lat := (NEW.attachments->>'latitude')::double precision;
    v_lng := (NEW.attachments->>'longitude')::double precision;
  EXCEPTION WHEN OTHERS THEN
    v_lat := NULL; v_lng := NULL;
  END;
  IF v_lat IS NULL OR v_lng IS NULL THEN
    RETURN NEW;
  END IF;

  -- No configured boundary -> nothing to enforce against.
  SELECT points INTO v_points
  FROM public.geofence_boundaries
  WHERE is_active
  LIMIT 1;
  IF v_points IS NULL THEN
    RETURN NEW;
  END IF;
  v_count := jsonb_array_length(v_points);
  IF v_count < 3 THEN
    RETURN NEW;
  END IF;

  -- Ray-casting identical to src/utils/geofence.js isPointInBoundary:
  -- latitude is Y, longitude is X; points carry {latitude, longitude}.
  j := v_count - 1;
  FOR i IN 0 .. v_count - 1 LOOP
    xi := (v_points->i->>'latitude')::double precision;
    yi := (v_points->i->>'longitude')::double precision;
    xj := (v_points->j->>'latitude')::double precision;
    yj := (v_points->j->>'longitude')::double precision;
    IF ((xi > v_lat) <> (xj > v_lat))
       AND (v_lng < ((yj - yi) * (v_lat - xi)) / (xj - xi) + yi) THEN
      v_inside := NOT v_inside;
    END IF;
    j := i;
  END LOOP;

  IF NOT v_inside THEN
    RAISE EXCEPTION 'This location is outside the Barangay Kalubihan service area — emergency reports can only be filed for incidents inside the boundary.'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_service_area ON public.emergency_reports;
CREATE TRIGGER trg_enforce_service_area
  BEFORE INSERT
  ON public.emergency_reports
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_service_area();

COMMIT;
