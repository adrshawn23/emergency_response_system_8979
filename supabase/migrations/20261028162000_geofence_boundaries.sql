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
-- Vertices hand-traced from the Google Maps barangay outline
-- (9 points, entered via the boundary editor) — keep in sync with
-- supabase/set_kalubihan_boundary.sql.
-- Skip the seed when a boundary already exists (the single-active index
-- would reject a second is_active=true row, and name has no unique key).
INSERT INTO public.geofence_boundaries (name, points, is_active)
SELECT
    'Barangay Kalubihan',
    '[
        {"latitude": 10.298938, "longitude": 123.895590},
        {"latitude": 10.299587, "longitude": 123.896851},
        {"latitude": 10.297719, "longitude": 123.897473},
        {"latitude": 10.298869, "longitude": 123.899952},
        {"latitude": 10.297613, "longitude": 123.900633},
        {"latitude": 10.296214, "longitude": 123.898262},
        {"latitude": 10.294826, "longitude": 123.897704},
        {"latitude": 10.294267, "longitude": 123.899083},
        {"latitude": 10.293470, "longitude": 123.897033}
    ]'::jsonb,
    true
WHERE NOT EXISTS (
    SELECT 1 FROM public.geofence_boundaries WHERE is_active
);
