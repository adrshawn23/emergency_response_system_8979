-- Store a sender_name snapshot on incident_messages so chat can display the
-- sender's name without reading user_profiles (blocked for the other party
-- by profile RLS — residents can't see responder profiles and vice versa).
-- Apply via the Supabase SQL editor.

ALTER TABLE public.incident_messages
    ADD COLUMN IF NOT EXISTS sender_name text;

-- Backfill names for existing rows from user_profiles.
UPDATE public.incident_messages im
SET sender_name = up.full_name
FROM public.user_profiles up
WHERE up.id::text = im.sender_id::text
  AND im.sender_name IS NULL;
