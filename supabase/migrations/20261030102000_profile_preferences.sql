-- Per-user notification preferences, persisted server-side.
-- Security notifications (verification decisions, incident status on own
-- reports) are mandatory and enforced in the client UI; the preference flags
-- below only gate the optional categories.

ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS notification_prefs jsonb NOT NULL DEFAULT '{
    "incident_updates": true,
    "assignment_updates": true,
    "verification_updates": true,
    "registration_reviews": true
  }'::jsonb;

COMMENT ON COLUMN public.user_profiles.notification_prefs IS
  'Per-user in-app notification preferences. Mandatory categories are enforced client-side; this JSONB gates optional ones.';
