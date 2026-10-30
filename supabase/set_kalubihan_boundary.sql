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

-- Single fresh active row — polygon traced from the public Google/OSM
-- barangay outline (Colon St / Sanciangko St / Parian Estero / Magallanes St).
INSERT INTO public.geofence_boundaries (name, points, is_active)
VALUES (
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
);

COMMIT;

-- Quick check afterwards:
--   SELECT name, is_active, jsonb_array_length(points) AS vertices
--   FROM public.geofence_boundaries;
