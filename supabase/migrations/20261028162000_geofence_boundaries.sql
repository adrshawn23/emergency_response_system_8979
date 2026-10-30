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
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'geofence_boundaries_min_vertices'
          AND conrelid = 'public.geofence_boundaries'::regclass
    ) THEN
        ALTER TABLE public.geofence_boundaries
            ADD CONSTRAINT geofence_boundaries_min_vertices
            CHECK (jsonb_array_length(points) >= 3);
    END IF;
END $$;

-- At most one active boundary: the client reads `.eq('is_active', true)`
-- with maybeSingle(), so two active rows would silently return null.
CREATE UNIQUE INDEX IF NOT EXISTS geofence_boundaries_single_active
    ON public.geofence_boundaries (is_active)
    WHERE is_active;

ALTER TABLE public.geofence_boundaries ENABLE ROW LEVEL SECURITY;

-- Everyone authenticated needs to READ the active boundary for the GPS check
-- (the emergency-report flow runs as a logged-in resident).
DROP POLICY IF EXISTS geofence_boundaries_read_active
    ON public.geofence_boundaries;
CREATE POLICY geofence_boundaries_read_active
    ON public.geofence_boundaries
    FOR SELECT
    TO authenticated
    USING (true);

-- Only admins manage polygons.
DROP POLICY IF EXISTS geofence_boundaries_admin_write
    ON public.geofence_boundaries;
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

DROP TRIGGER IF EXISTS geofence_boundaries_updated_at
    ON public.geofence_boundaries;
CREATE TRIGGER geofence_boundaries_updated_at
    BEFORE UPDATE ON public.geofence_boundaries
    FOR EACH ROW EXECUTE FUNCTION public.geofence_touch_updated_at();

-- Seed polygon for Barangay Kalubihan (Pob.), Cebu City — PSGC 0730600033
-- (formerly 072217033), official center ~10.2968 N, 123.8979 E.
-- Vertices are traced from the public Google/OpenStreetMap barangay outline:
--   Colon St (west), Sanciangko St (north), Parian Estero (east),
--   Magallanes St (south), covering Elizabeth Mall, Cebu City Medical Center,
--   and the Gaisano Main / USJ-R area. Replace with the official GIS
--   boundary file when the barangay provides it — the client only needs an
--   ordered ring.
-- Skip the seed when a boundary already exists (the single-active index
-- would reject a second is_active=true row, and name has no unique key).
INSERT INTO public.geofence_boundaries (name, points, is_active)
SELECT
    'Barangay Kalubihan',
    '[
        {"latitude": 10.3002, "longitude": 123.8952},
        {"latitude": 10.3003, "longitude": 123.8978},
        {"latitude": 10.2992, "longitude": 123.9006},
        {"latitude": 10.2960, "longitude": 123.9008},
        {"latitude": 10.2938, "longitude": 123.8995},
        {"latitude": 10.2937, "longitude": 123.8970},
        {"latitude": 10.2942, "longitude": 123.8950},
        {"latitude": 10.2975, "longitude": 123.8947},
        {"latitude": 10.3002, "longitude": 123.8952}
    ]'::jsonb,
    true
WHERE NOT EXISTS (
    SELECT 1 FROM public.geofence_boundaries WHERE is_active
);
