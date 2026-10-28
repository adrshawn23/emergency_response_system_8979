-- Fix handle_new_user so a trigger-created profile is complete and safe.
--
-- Before: the trigger only copied id/email/full_name/role. When email
-- confirmation is enabled, signUp returns no session, so the client-side
-- profile UPDATE runs as anonymous and fails under RLS — the new user ended
-- up with a bare profile (no names/phone/address) and registration surfaced
-- "Registration failed" even though the auth account existed.
--
-- It also trusted raw_user_meta_data->>'role', letting anyone self-register
-- as 'admin'. Public signup is resident-only; staff accounts are created by
-- admins directly in user_profiles (no auth.users INSERT, no trigger).
--
-- After: the trigger populates the registration fields from metadata, marks
-- every self-registered account pending admin approval
-- (status='inactive', account_status='pending'), creates a pending ID
-- verification row for the residents review queue, and inserts the
-- emergency contacts collected in registration step 5.
--
-- Column names match the LIVE table: `phone` (not phone_number) and no
-- is_active column — the earlier draft referenced both and the trigger
-- INSERT failed, aborting auth.users signup with
-- "Database error saving new user".

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    contact jsonb;
BEGIN
    INSERT INTO public.user_profiles (
        id,
        email,
        full_name,
        first_name,
        last_name,
        phone,
        birthdate,
        address,
        role,
        status,
        account_status
    )
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(
            NEW.raw_user_meta_data->>'full_name',
            NULLIF(concat_ws(' ',
                NEW.raw_user_meta_data->>'first_name',
                NEW.raw_user_meta_data->>'last_name'), ''),
            split_part(NEW.email, '@', 1)
        ),
        NEW.raw_user_meta_data->>'first_name',
        NEW.raw_user_meta_data->>'last_name',
        NEW.raw_user_meta_data->>'phone',
        NULLIF(NEW.raw_user_meta_data->>'birthdate', '')::date,
        NEW.raw_user_meta_data->>'address',
        'resident'::public.user_role,
        'inactive',
        'pending'
    );

    -- Pending ID verification backed by the real OCR run performed during
    -- registration (tesseract.js in-browser). id_document_url is the stored
    -- ID photo (data URL); ocr_data carries the parsed name/DOB match flags.
    INSERT INTO public.id_verifications (
        user_id,
        id_document_url,
        ocr_data,
        ocr_confidence,
        verification_status
    )
    VALUES (
        NEW.id,
        NULLIF(NEW.raw_user_meta_data->>'id_document_url', ''),
        COALESCE(NEW.raw_user_meta_data->'ocr_data', '{}')::jsonb,
        COALESCE((NEW.raw_user_meta_data->>'ocr_confidence')::int, 0),
        'pending'
    );

    -- Emergency contacts from registration step 5. Rows with missing
    -- required fields are skipped so bad metadata cannot abort signup.
    IF jsonb_typeof(NEW.raw_user_meta_data->'emergency_contacts') = 'array' THEN
        FOR contact IN SELECT * FROM jsonb_array_elements(NEW.raw_user_meta_data->'emergency_contacts')
        LOOP
            IF COALESCE(contact->>'name', '') <> ''
               AND COALESCE(contact->>'phone', '') <> ''
               AND COALESCE(contact->>'relationship', '') <> '' THEN
                INSERT INTO public.emergency_contacts (
                    user_id,
                    name,
                    relationship,
                    phone_number,
                    is_primary
                )
                VALUES (
                    NEW.id,
                    contact->>'name',
                    contact->>'relationship',
                    contact->>'phone',
                    COALESCE((contact->>'is_primary')::boolean, false)
                );
            END IF;
        END LOOP;
    END IF;

    RETURN NEW;
END;
$$;
