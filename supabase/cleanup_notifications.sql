-- Notification cleanup — run in the Supabase SQL editor.
-- The table has no client delete path (triggers/SECURITY DEFINER only), so
-- stale rows can only be purged here.
--
-- STEP 1: preview what will be removed — run this block first.

SELECT type,
       count(*)                                         AS total,
       count(*) FILTER (WHERE read_at IS NULL)          AS unread,
       count(*) FILTER (
         WHERE incident_id IS NOT NULL
           AND NOT EXISTS (SELECT 1 FROM public.emergency_reports r
                           WHERE r.id = n.incident_id))  AS orphaned_incidents,
       count(*) FILTER (
         WHERE recipient_id IS NOT NULL
           AND NOT EXISTS (SELECT 1 FROM public.user_profiles p
                           WHERE p.id = n.recipient_id))  AS dead_recipients
FROM public.notifications n
GROUP BY type
ORDER BY type;

-- STEP 2: delete the non-applicable rows.

BEGIN;

-- Incident notifications whose report was deleted — clicking these is a
-- dead end, so they're never applicable.
DELETE FROM public.notifications n
WHERE n.incident_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.emergency_reports r WHERE r.id = n.incident_id
  );

-- Notifications for profiles that no longer exist.
DELETE FROM public.notifications n
WHERE n.recipient_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.user_profiles p WHERE p.id = n.recipient_id
  );

COMMIT;

-- Every notification still tied to a live incident + a live recipient stays
-- visible for that user — nothing else is touched.

-- OPTIONAL: wipe the table entirely (test env only) — uncomment instead of
-- the block above if you want a clean slate.
-- TRUNCATE public.notifications;
