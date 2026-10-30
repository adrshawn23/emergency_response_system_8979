-- ============================================================================
-- Set the live service boundary to Barangay Kalubihan, Cebu City.
-- Run this in the Supabase SQL editor — the 20261028162000 migration seed only
-- fires when NO active boundary exists, so it will not replace the demo polygon
-- that is already in the live geofence_boundaries table.
--
-- Safe to re-run: inside one transaction it deactivates the current polygon,
-- removes any rows named 'Barangay Kalubihan' (previous seed/failed versions —
-- name has no unique constraint so upserts silently duplicate), then inserts
-- one fresh active row.
-- ============================================================================

BEGIN;

-- Deactivate whatever is currently active (demo box or an older version).
UPDATE public.geofence_boundaries
SET is_active = false
WHERE is_active = true;

-- Drop stale Kalubihan rows (seed version, partial runs). To keep old
-- versions for rollback instead, rename them before re-running:
--   UPDATE public.geofence_boundaries
--   SET name = name || ' (archived ' || now()::date || ')'
--   WHERE name = 'Barangay Kalubihan';
DELETE FROM public.geofence_boundaries
WHERE name = 'Barangay Kalubihan';

-- Single fresh active row — polygon hand-traced from the Google Maps
-- Kalubihan barangay outline (9 vertices, entered via the boundary editor).
INSERT INTO public.geofence_boundaries (name, points, is_active)
VALUES (
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
);

COMMIT;

-- Quick check afterwards:
--   SELECT name, is_active, jsonb_array_length(points) AS vertices
--   FROM public.geofence_boundaries;
