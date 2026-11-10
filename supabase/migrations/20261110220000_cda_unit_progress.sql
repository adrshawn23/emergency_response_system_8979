-- Per-unit progress on cross-department assistance.
-- Each assisting unit tracks its own chain: Assigned → Responding →
-- Arrived → Resolved — while the main department keeps owning the
-- incident's overall status.
--
-- No new UPDATE policy needed: cda_staff_update already lets the
-- assisting department's responders write the row.
--
-- Apply via Supabase SQL editor.

BEGIN;

ALTER TABLE public.cross_department_assistance
    ADD COLUMN IF NOT EXISTS assigned_at     TIMESTAMPTZ,  -- dept admin picked a responder
    ADD COLUMN IF NOT EXISTS acknowledged_at TIMESTAMPTZ,  -- responder en route ("Responding")
    ADD COLUMN IF NOT EXISTS arrived_at      TIMESTAMPTZ,  -- unit on scene
    ADD COLUMN IF NOT EXISTS resolved_at     TIMESTAMPTZ,  -- unit's task done
    ADD COLUMN IF NOT EXISTS resolution_proof TEXT;        -- photo doc (data URL, like reports.attachments.resolution_proof)

-- The reporting resident reads the unit list on their tracking view —
-- dept names + step progress only (RLS still hides writes).
CREATE POLICY cda_reporter_select ON public.cross_department_assistance
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.emergency_reports er
            WHERE er.id = cross_department_assistance.report_id
              AND er.reporter_id = auth.uid()
        )
    );

-- mark_cda_arrived — GPS-verified arrival for an assisting unit, mirroring
-- mark_incident_arrived: caller must be the CDA's responder, position is
-- re-verified server-side against responder_locations within
-- arrival_radius_m. Units write cda.arrived_at (not incident_status_history
-- — uq_incident_arrived allows only one arrival per report anyway).
CREATE OR REPLACE FUNCTION public.mark_cda_arrived(p_cda_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
    v_uid     uuid := auth.uid();
    v_role    text;
    v_name    text;
    v_cda     public.cross_department_assistance%ROWTYPE;
    v_report  public.emergency_reports%ROWTYPE;
    v_rlat    double precision;
    v_rlng    double precision;
    v_lat     double precision;
    v_lng     double precision;
    v_dist    double precision;
    v_radius  double precision;
BEGIN
    IF v_uid IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'error', 'unauthorized');
    END IF;

    SELECT role, full_name INTO v_role, v_name
    FROM public.user_profiles WHERE id = v_uid;

    IF v_role IS DISTINCT FROM 'responder' THEN
        RETURN jsonb_build_object('ok', false, 'error', 'unauthorized');
    END IF;

    SELECT * INTO v_cda FROM public.cross_department_assistance WHERE id = p_cda_id;
    IF v_cda IS NULL
       OR v_cda.responder_id IS DISTINCT FROM v_uid
       OR v_cda.status <> 'accepted' THEN
        RETURN jsonb_build_object('ok', false, 'error', 'invalid_state');
    END IF;

    IF v_cda.arrived_at IS NOT NULL THEN
        RETURN jsonb_build_object('ok', true, 'already', true, 'arrived_at', v_cda.arrived_at);
    END IF;

    SELECT * INTO v_report FROM public.emergency_reports WHERE id = v_cda.report_id;
    IF v_report IS NULL OR v_report.status IN ('resolved', 'declined') THEN
        RETURN jsonb_build_object('ok', false, 'error', 'invalid_state');
    END IF;

    SELECT COALESCE((value)::text::double precision, 50) INTO v_radius
    FROM public.app_settings WHERE key = 'arrival_radius_m';
    v_radius := COALESCE(v_radius, 50);

    SELECT latitude, longitude INTO v_rlat, v_rlng
    FROM public.responder_locations WHERE responder_id = v_uid;

    SELECT lat, lng INTO v_lat, v_lng FROM public.incident_coords(v_cda.report_id);

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

    UPDATE public.cross_department_assistance
    SET arrived_at = now(), updated_at = now()
    WHERE id = p_cda_id;

    INSERT INTO public.notifications (recipient_id, type, title, message, incident_id, metadata, delivery_status)
    VALUES (v_report.reporter_id, 'incident_status',
            'Assisting unit arrived',
            'An assisting responder (' || COALESCE(v_name, 'unit') || ') has arrived at your ' || COALESCE(v_report.report_type, 'emergency') || ' report.',
            v_cda.report_id,
            jsonb_build_object('report_id', v_cda.report_id, 'status', 'arrived', 'unit', 'assistance'),
            'sent');

    RETURN jsonb_build_object('ok', true, 'arrived_at', now(), 'distance_m', round(v_dist::numeric, 1));
END;
$$;

GRANT EXECUTE ON FUNCTION public.mark_cda_arrived(uuid) TO authenticated;

-- Realtime so unit steps update live on open timelines.
DO $$ BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.cross_department_assistance;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

COMMIT;
