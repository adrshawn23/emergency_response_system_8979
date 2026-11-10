-- Registration role + department metadata (spec: registration role picker)
--
-- Registration now offers admin / dispatcher / responder /
-- department_admin / resident options, with a department dropdown required
-- for responder and department_admin. create_pending_profile previously
-- hardcoded role = 'resident' and never read department_id, so every
-- signup became a resident regardless of choice.
--
-- The chosen role is validated against the user_role enum (garbage
-- values fall back to 'resident'); department_id is read when present.
-- Accounts still land status='pending' / account_status='inactive' —
-- administrative approval still gates activation for every role.

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
        birthdate, address, residency_type, role, status, account_status,
        department_id
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
        -- Chosen role, validated against the enum — unknown values fall
        -- back to 'resident' rather than failing the whole insert.
        CASE
            WHEN (u.raw_user_meta_data->>'role')::text IN (
                SELECT e.enumlabel::text
                FROM pg_enum e
                JOIN pg_type t ON t.oid = e.enumtypid
                WHERE t.typname = 'user_role'
            )
            THEN (u.raw_user_meta_data->>'role')::public.user_role
            ELSE 'resident'::public.user_role
        END,
        'inactive',
        'pending',
        NULLIF(u.raw_user_meta_data->>'department_id', '')::uuid
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
