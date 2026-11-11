-- incident_radius_m — admin-tunable map radius (was hardcoded 150 in the
-- incident detail modals). Read via the app_settings_authenticated_read
-- policy; admins/dispatchers already have write access through
-- app_settings_staff_write. The UI falls back to 150 until this row exists.
--
-- Apply via Supabase SQL editor.

BEGIN;

INSERT INTO public.app_settings (key, value)
VALUES ('incident_radius_m', '150')
ON CONFLICT (key) DO NOTHING;

COMMIT;
