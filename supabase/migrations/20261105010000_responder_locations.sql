-- Live responder location sharing.
-- One row per responder, updated client-side while they carry an active
-- assignment. Residents can read ONLY the responder assigned to their own
-- open report; staff (admin/dispatcher/responder) can read all rows.

CREATE TABLE IF NOT EXISTS public.responder_locations (
    responder_id uuid PRIMARY KEY REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    latitude    double precision NOT NULL,
    longitude   double precision NOT NULL,
    updated_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.responder_locations ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE ON public.responder_locations TO authenticated;

DROP POLICY IF EXISTS "responder_locations_self_insert" ON public.responder_locations;
CREATE POLICY "responder_locations_self_insert"
    ON public.responder_locations
    FOR INSERT
    TO authenticated
    WITH CHECK (responder_id = auth.uid());

DROP POLICY IF EXISTS "responder_locations_self_update" ON public.responder_locations;
CREATE POLICY "responder_locations_self_update"
    ON public.responder_locations
    FOR UPDATE
    TO authenticated
    USING (responder_id = auth.uid())
    WITH CHECK (responder_id = auth.uid());

DROP POLICY IF EXISTS "responder_locations_staff_read" ON public.responder_locations;
CREATE POLICY "responder_locations_staff_read"
    ON public.responder_locations
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles up
            WHERE up.id = auth.uid()
              AND up.role IN ('admin', 'dispatcher', 'responder')
        )
    );

DROP POLICY IF EXISTS "responder_locations_reporter_read" ON public.responder_locations;
CREATE POLICY "responder_locations_reporter_read"
  ON public.responder_locations
  FOR SELECT
  TO authenticated
  USING (
    -- Assigned responder on my unresolved report…
    EXISTS (
      SELECT 1 FROM public.emergency_reports er
      WHERE er.reporter_id = auth.uid()
        AND er.assigned_to = responder_locations.responder_id
        AND er.status <> 'resolved'
    )
    OR
    -- …or a responder who accepted an assistance request on it.
    EXISTS (
      SELECT 1
      FROM public.cross_department_assistance cda
      JOIN public.emergency_reports er ON er.id = cda.report_id
      WHERE er.reporter_id = auth.uid()
        AND er.status <> 'resolved'
        AND cda.status = 'accepted'
        AND cda.responded_by = responder_locations.responder_id
    )
  );

-- Realtime so the incident map marker moves live.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime'
          AND schemaname = 'public'
          AND tablename = 'responder_locations'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.responder_locations;
    END IF;
END $$;
