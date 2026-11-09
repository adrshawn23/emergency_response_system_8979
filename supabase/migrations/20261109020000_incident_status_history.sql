-- Spec 001: incident status tracking timeline.
-- Append-only transition history + GPS-gated arrival + app_settings.
-- Apply via Supabase SQL editor (migrations are applied manually).
-- NOTE: 20261016090000_operational_workflows.sql sketches a different
-- incident_status_history shape (incident_id) but was never applied live
-- (probed PGRST205 2026-11-09). This is the authoritative table: report_id.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. incident_status_history — the timeline's source of truth (FR-005).
--    Append-only: no INSERT/UPDATE/DELETE grants; rows come from the
--    status-change trigger (definer) or the arrival RPCs only.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.incident_status_history (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    report_id   uuid NOT NULL REFERENCES public.emergency_reports(id) ON DELETE CASCADE,
    from_status text,                    -- NULL for the first recorded hop
    to_status   text NOT NULL,           -- pending|assigned|in-progress|resolved|declined|arrived
    actor_id    uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    meta        jsonb,                   -- {method:'gps'|'manual', distance_m, marked_by_name, ...}
    created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_incident_history_report
    ON public.incident_status_history (report_id, created_at);

-- One arrival per incident (double-tap / replay safe).
CREATE UNIQUE INDEX IF NOT EXISTS uq_incident_arrived
    ON public.incident_status_history (report_id)
    WHERE to_status = 'arrived';

ALTER TABLE public.incident_status_history ENABLE ROW LEVEL SECURITY;

-- Read-only for clients; all writes happen inside definer functions/triggers.
GRANT SELECT ON public.incident_status_history TO authenticated;

DROP POLICY IF EXISTS "incident_history_staff_read" ON public.incident_status_history;
CREATE POLICY "incident_history_staff_read"
    ON public.incident_status_history FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles up
            WHERE up.id = auth.uid()
              AND up.role IN ('admin', 'dispatcher', 'responder')
        )
    );

DROP POLICY IF EXISTS "incident_history_reporter_read" ON public.incident_status_history;
CREATE POLICY "incident_history_reporter_read"
    ON public.incident_status_history FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.emergency_reports er
            WHERE er.id = incident_status_history.report_id
              AND er.reporter_id = auth.uid()
        )
    );

-- ---------------------------------------------------------------------------
-- 2. Status-change trigger — records every transition for EVERY writer path
--    (dispatcher assign, responder acknowledge/resolve, admin decline,
--    direct updates). 'arrived' never passes through here (not a status).
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.log_incident_status_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
    IF OLD.status IS DISTINCT FROM NEW.status THEN
        INSERT INTO public.incident_status_history (report_id, from_status, to_status, actor_id)
        VALUES (NEW.id, OLD.status::text, NEW.status::text, auth.uid());
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_incident_status ON public.emergency_reports;
CREATE TRIGGER trg_log_incident_status
    AFTER UPDATE OF status ON public.emergency_reports
    FOR EACH ROW EXECUTE FUNCTION public.log_incident_status_change();

-- ---------------------------------------------------------------------------
-- 3. app_settings — admin/dispatcher-tunable knobs (FR-012).
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.app_settings (
    key        text PRIMARY KEY,
    value      jsonb NOT NULL,
    updated_at timestamptz NOT NULL DEFAULT now(),
    updated_by uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL
);

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.app_settings TO authenticated;
GRANT INSERT, UPDATE ON public.app_settings TO authenticated;

DROP POLICY IF EXISTS "app_settings_authenticated_read" ON public.app_settings;
CREATE POLICY "app_settings_authenticated_read"
    ON public.app_settings FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "app_settings_staff_write" ON public.app_settings;
CREATE POLICY "app_settings_staff_write"
    ON public.app_settings FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles up
            WHERE up.id = auth.uid() AND up.role IN ('admin', 'dispatcher')
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.user_profiles up
            WHERE up.id = auth.uid() AND up.role IN ('admin', 'dispatcher')
        )
    );

INSERT INTO public.app_settings (key, value)
VALUES ('arrival_radius_m', '50')
ON CONFLICT (key) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 4. Coordinate extraction — mirrors src/utils/reportCoords.js:
--    attachments.latitude/longitude first, then "lat, lng" inside
--    attachments.location text. Returns NULLs when unresolvable.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.incident_coords(p_report_id uuid,
    OUT lat double precision, OUT lng double precision)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
    v_atts  jsonb;
    v_match text[];
BEGIN
    SELECT attachments INTO v_atts
    FROM public.emergency_reports WHERE id = p_report_id;

    IF v_atts IS NULL THEN
        lat := NULL; lng := NULL; RETURN;
    END IF;

    BEGIN
        lat := NULLIF(v_atts->>'latitude', '')::double precision;
        lng := NULLIF(v_atts->>'longitude', '')::double precision;
    EXCEPTION WHEN others THEN
        lat := NULL; lng := NULL;
    END;

    IF lat IS NULL OR lng IS NULL THEN
        SELECT m INTO v_match FROM regexp_match(
            COALESCE(v_atts->>'location', ''),
            '(-?\d{1,3}\.\d{4,})\s*,\s*(-?\d{1,3}\.\d{4,})'
        ) AS m;
        IF v_match IS NOT NULL THEN
            lat := v_match[1]::double precision;
            lng := v_match[2]::double precision;
        END IF;
    END IF;

    -- Validate range like reportCoords (|lat| <= 90, |lng| <= 180).
    IF lat IS NULL OR lng IS NULL OR abs(lat) > 90 OR abs(lng) > 180 THEN
        lat := NULL; lng := NULL;
    END IF;
END;
$$;

-- ---------------------------------------------------------------------------
-- 5. mark_incident_arrived — GPS-verified responder arrival (FR-011..013).
--    SECURITY DEFINER: re-checks everything server-side; the client's
--    disabled-button math is UX only. Idempotent on already_arrived.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.mark_incident_arrived(p_report_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
    v_uid     uuid := auth.uid();
    v_role    text;
    v_report  public.emergency_reports%ROWTYPE;
    v_rlat    double precision;
    v_rlng    double precision;
    v_lat     double precision;
    v_lng     double precision;
    v_dist    double precision;
    v_radius  double precision;
    v_arrived timestamptz;
    v_name    text;
BEGIN
    IF v_uid IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'error', 'unauthorized');
    END IF;

    SELECT role, full_name INTO v_role, v_name
    FROM public.user_profiles WHERE id = v_uid;

    IF v_role IS DISTINCT FROM 'responder' THEN
        RETURN jsonb_build_object('ok', false, 'error', 'unauthorized');
    END IF;

    SELECT * INTO v_report FROM public.emergency_reports WHERE id = p_report_id;
    IF v_report IS NULL
       OR v_report.assigned_to IS DISTINCT FROM v_uid
       OR v_report.status <> 'in-progress' THEN
        RETURN jsonb_build_object('ok', false, 'error', 'invalid_state');
    END IF;

    -- Idempotent: a prior arrival returns success with the original time.
    SELECT created_at INTO v_arrived FROM public.incident_status_history
    WHERE report_id = p_report_id AND to_status = 'arrived';
    IF v_arrived IS NOT NULL THEN
        RETURN jsonb_build_object('ok', true, 'already', true, 'arrived_at', v_arrived);
    END IF;

    SELECT COALESCE((value)::text::double precision, 50) INTO v_radius
    FROM public.app_settings WHERE key = 'arrival_radius_m';
    v_radius := COALESCE(v_radius, 50);

    SELECT latitude, longitude INTO v_rlat, v_rlng
    FROM public.responder_locations WHERE responder_id = v_uid;

    SELECT lat, lng INTO v_lat, v_lng FROM public.incident_coords(p_report_id);

    IF v_rlat IS NULL OR v_lat IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'error', 'location_unavailable', 'radius_m', v_radius);
    END IF;

    v_dist := 6371000 * acos(LEAST(1, GREATEST(-1,
        cos(radians(v_rlat)) * cos(radians(v_lat)) * cos(radians(v_lng) - radians(v_rlng))
        + sin(radians(v_rlat)) * sin(radians(v_lat)))));

    IF v_dist > v_radius THEN
        RETURN jsonb_build_object('ok', false, 'error', 'too_far',
            'distance_m', round(v_dist::numeric, 1), 'radius_m', v_radius);
    END IF;

    INSERT INTO public.incident_status_history (report_id, from_status, to_status, actor_id, meta)
    VALUES (p_report_id, 'in-progress', 'arrived', v_uid,
            jsonb_build_object('method', 'gps',
                               'distance_m', round(v_dist::numeric, 1),
                               'responder_name', v_name))
    RETURNING created_at INTO v_arrived;

    -- Feed the existing notification path (same shape as create_notification).
    INSERT INTO public.notifications (recipient_id, type, title, message, incident_id, metadata, delivery_status)
    VALUES (v_report.reporter_id, 'incident_status',
            'Responder arrived',
            'A responder has arrived at your ' || COALESCE(v_report.report_type, 'emergency') || ' report.',
            p_report_id,
            jsonb_build_object('report_id', p_report_id, 'status', 'arrived'),
            'sent');

    RETURN jsonb_build_object('ok', true, 'arrived_at', v_arrived, 'distance_m', round(v_dist::numeric, 1));
END;
$$;

-- ---------------------------------------------------------------------------
-- 6. mark_incident_arrived_manual — staff fallback when responder GPS fails
--    (FR-017). admin/dispatcher only; audited via meta.method='manual'.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.mark_incident_arrived_manual(p_report_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
    v_uid     uuid := auth.uid();
    v_role    text;
    v_name    text;
    v_report  public.emergency_reports%ROWTYPE;
    v_arrived timestamptz;
BEGIN
    IF v_uid IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'error', 'unauthorized');
    END IF;

    SELECT role, full_name INTO v_role, v_name
    FROM public.user_profiles WHERE id = v_uid;

    IF v_role IS NULL OR v_role NOT IN ('admin', 'dispatcher') THEN
        RETURN jsonb_build_object('ok', false, 'error', 'unauthorized');
    END IF;

    SELECT * INTO v_report FROM public.emergency_reports WHERE id = p_report_id;
    IF v_report IS NULL OR v_report.status <> 'in-progress' THEN
        RETURN jsonb_build_object('ok', false, 'error', 'invalid_state');
    END IF;

    SELECT created_at INTO v_arrived FROM public.incident_status_history
    WHERE report_id = p_report_id AND to_status = 'arrived';
    IF v_arrived IS NOT NULL THEN
        RETURN jsonb_build_object('ok', true, 'already', true, 'arrived_at', v_arrived);
    END IF;

    INSERT INTO public.incident_status_history (report_id, from_status, to_status, actor_id, meta)
    VALUES (p_report_id, 'in-progress', 'arrived', v_uid,
            jsonb_build_object('method', 'manual', 'marked_by_name', v_name))
    RETURNING created_at INTO v_arrived;

    INSERT INTO public.notifications (recipient_id, type, title, message, incident_id, metadata, delivery_status)
    VALUES (v_report.reporter_id, 'incident_status',
            'Responder arrived',
            'A responder has arrived at your ' || COALESCE(v_report.report_type, 'emergency') || ' report.',
            p_report_id,
            jsonb_build_object('report_id', p_report_id, 'status', 'arrived', 'method', 'manual'),
            'sent');

    RETURN jsonb_build_object('ok', true, 'arrived_at', v_arrived, 'method', 'manual');
END;
$$;

REVOKE ALL ON FUNCTION public.incident_coords(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.incident_coords(uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.mark_incident_arrived(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_incident_arrived_manual(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.incident_coords(uuid) TO authenticated;  -- harmless read, reuse allowed

-- ---------------------------------------------------------------------------
-- 7. responder_locations: 'declined' is terminal too — stop reporter reads
--    (spec edge case: pin sharing ends on terminal states).
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "responder_locations_reporter_read" ON public.responder_locations;
CREATE POLICY "responder_locations_reporter_read"
  ON public.responder_locations
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.emergency_reports er
      WHERE er.reporter_id = auth.uid()
        AND er.assigned_to = responder_locations.responder_id
        AND er.status NOT IN ('resolved', 'declined')
    )
    OR
    EXISTS (
      SELECT 1
      FROM public.cross_department_assistance cda
      JOIN public.emergency_reports er ON er.id = cda.report_id
      WHERE er.reporter_id = auth.uid()
        AND er.status NOT IN ('resolved', 'declined')
        AND cda.status = 'accepted'
        AND cda.responded_by = responder_locations.responder_id
    )
  );

-- ---------------------------------------------------------------------------
-- 8. Realtime for the timeline.
-- ---------------------------------------------------------------------------

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime'
          AND schemaname = 'public'
          AND tablename = 'incident_status_history'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.incident_status_history;
    END IF;
END $$;

COMMIT;
