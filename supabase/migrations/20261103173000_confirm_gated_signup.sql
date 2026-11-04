-- Gate registration artifacts on email confirmation.
--
-- Problem: handle_new_user created user_profiles + emergency_contacts +
-- a bare id_verifications row the moment signUp was called — BEFORE the
-- 6-digit code was entered. Abandoned/unconfirmed signups littered the
-- admin queue with pending entries showing "No ID document uploaded"
-- (the document only reaches verify-id after verifyOtp succeeds).
--
-- Fix:
--   * Shared logic moves into create_pending_profile(auth.users).
--   * handle_new_user now does NOTHING for unconfirmed signups — the
--     auth.users row still exists (Supabase creates it) but no profile,
--     contacts, or queue entries appear. Admin-created/seeded users that
--     arrive already confirmed keep the old immediate behaviour.
--   * A new handle_user_confirmed trigger on auth.users fires the moment
--     email_confirmed_at transitions NULL -> set (verifyOtp success) and
--     builds the profile + contacts then.
--   * The bare 'pending' id_verifications row is only created when the
--     signup metadata actually carries an id_document_url — the current
--     registration flow never supplies one, so no more ghost rows; the
--     real row is inserted by verify-id / the storage fallback.

-- Residency claim captured at registration. Residents must prove a Kalubihan
-- home address; boarders live in Kalubihan but their ID shows a home address
-- elsewhere, so an outside address on the ID is expected and an admin
-- verifies the boarding residence instead (handled in verify-id).
ALTER TABLE public.user_profiles
    ADD COLUMN IF NOT EXISTS residency_type text NOT NULL DEFAULT 'resident'
    CONSTRAINT user_profiles_residency_type_check
    CHECK (residency_type IN ('resident', 'boarder'));

CREATE OR REPLACE FUNCTION public.create_pending_profile(u auth.users)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    contact jsonb;
BEGIN
    INSERT INTO public.user_profiles (
        id, email, full_name, first_name, last_name, phone,
        birthdate, address, residency_type, role, status, account_status
    )
    VALUES (
        u.id,
        u.email,
        COALESCE(
            u.raw_user_meta_data->>'full_name',
            NULLIF(concat_ws(' ',
                u.raw_user_meta_data->>'first_name',
                u.raw_user_meta_data->>'last_name'), ''),
            split_part(u.email, '@', 1)
        ),
        u.raw_user_meta_data->>'first_name',
        u.raw_user_meta_data->>'last_name',
        u.raw_user_meta_data->>'phone',
        NULLIF(u.raw_user_meta_data->>'birthdate', '')::date,
        u.raw_user_meta_data->>'address',
        CASE WHEN u.raw_user_meta_data->>'residency_type' = 'boarder'
             THEN 'boarder' ELSE 'resident' END,
        'resident'::public.user_role,
        'inactive',
        'pending'
    )
    ON CONFLICT (id) DO NOTHING;

    -- Only create a verification row when metadata really carries a
    -- document (legacy/direct flows). OTP-gated registration supplies
    -- none — verify-id inserts the real row after the ID is submitted.
    IF NULLIF(u.raw_user_meta_data->>'id_document_url', '') IS NOT NULL THEN
        INSERT INTO public.id_verifications (
            user_id, id_document_url, ocr_data, ocr_confidence, verification_status
        )
        VALUES (
            u.id,
            NULLIF(u.raw_user_meta_data->>'id_document_url', ''),
            COALESCE(u.raw_user_meta_data->'ocr_data', '{}')::jsonb,
            COALESCE((u.raw_user_meta_data->>'ocr_confidence')::int, 0),
            'pending'
        );
    END IF;

    IF jsonb_typeof(u.raw_user_meta_data->'emergency_contacts') = 'array' THEN
        FOR contact IN SELECT * FROM jsonb_array_elements(u.raw_user_meta_data->'emergency_contacts')
        LOOP
            IF COALESCE(contact->>'name', '') <> ''
               AND COALESCE(contact->>'phone', '') <> ''
               AND COALESCE(contact->>'relationship', '') <> '' THEN
                INSERT INTO public.emergency_contacts (
                    user_id, name, relationship, phone_number, is_primary
                )
                VALUES (
                    u.id,
                    contact->>'name',
                    contact->>'relationship',
                    contact->>'phone',
                    COALESCE((contact->>'is_primary')::boolean, false)
                );
            END IF;
        END LOOP;
    END IF;
END;
$$;

-- Signup-time trigger: defer unconfirmed signups entirely.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF NEW.email_confirmed_at IS NULL THEN
        RETURN NEW; -- wait for handle_user_confirmed
    END IF;
    PERFORM public.create_pending_profile(NEW);
    RETURN NEW;
END;
$$;

-- Confirmation-time trigger: builds everything the moment the OTP is
-- accepted (email_confirmed_at NULL -> set).
CREATE OR REPLACE FUNCTION public.handle_user_confirmed()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF OLD.email_confirmed_at IS NULL AND NEW.email_confirmed_at IS NOT NULL THEN
        PERFORM public.create_pending_profile(NEW);
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_confirmed ON auth.users;
CREATE TRIGGER on_auth_user_confirmed
    AFTER UPDATE ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_user_confirmed();
