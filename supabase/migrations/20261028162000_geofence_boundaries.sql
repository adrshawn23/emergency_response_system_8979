-- Geofence boundaries: stores the administrator-managed service polygons that
-- LocationInput reads for the inside/outside GPS verdict.
--
-- points is a JSONB array of { "latitude": n, "longitude": n } vertices in
-- ring order (isPointInBoundary in src/utils/geofence.js also accepts
-- {lat, lng} keys). Only one row should be active at a time; keep older
-- versions with is_active = false so the active polygon can roll back.

CREATE TABLE IF NOT EXISTS public.geofence_boundaries (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    points jsonb NOT NULL DEFAULT '[]'::jsonb,
    is_active boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- Every polygon needs at least 3 vertices to be a ray-castable polygon.
ALTER TABLE public.geofence_boundaries
    ADD CONSTRAINT geofence_boundaries_min_vertices
    CHECK (jsonb_array_length(points) >= 3);

-- At most one active boundary: the client reads `.eq('is_active', true)`
-- with maybeSingle(), so two active rows would silently return null.
CREATE UNIQUE INDEX IF NOT EXISTS geofence_boundaries_single_active
    ON public.geofence_boundaries (is_active)
    WHERE is_active;

ALTER TABLE public.geofence_boundaries ENABLE ROW LEVEL SECURITY;

-- Everyone authenticated needs to READ the active boundary for the GPS check
-- (the emergency-report flow runs as a logged-in resident).
CREATE POLICY geofence_boundaries_read_active
    ON public.geofence_boundaries
    FOR SELECT
    TO authenticated
    USING (true);

-- Only admins manage polygons.
CREATE POLICY geofence_boundaries_admin_write
    ON public.geofence_boundaries
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles p
            WHERE p.id = auth.uid() AND p.role = 'admin'
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.user_profiles p
            WHERE p.id = auth.uid() AND p.role = 'admin'
        )
    );

-- Kept in this file so nothing depends on helpers from other migrations.
CREATE OR REPLACE FUNCTION public.geofence_touch_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at := now();
    RETURN NEW;
END;
$$;

CREATE TRIGGER geofence_boundaries_updated_at
    BEFORE UPDATE ON public.geofence_boundaries
    FOR EACH ROW EXECUTE FUNCTION public.geofence_touch_updated_at();

-- Seed polygon for Barangay Kalubihan, Cebu City (approximate box around the
-- barangay center ~10.2968 N, 123.8996 E). Replace these vertices with the
-- official GIS boundary when available — widen/shrink as needed; the client
-- only needs an ordered ring.
INSERT INTO public.geofence_boundaries (name, points, is_active)
VALUES (
    'Barangay Kalubihan (approximate)',
    '[
        {"latitude": 10.2895, "longitude": 123.8925},
        {"latitude": 10.3045, "longitude": 123.8925},
        {"latitude": 10.3045, "longitude": 123.9065},
        {"latitude": 10.2895, "longitude": 123.9065},
        {"latitude": 10.2895, "longitude": 123.8925}
    ]'::jsonb,
    true
)
ON CONFLICT DO NOTHING;
