-- Seeds per department: 1 department_admin (only if none exists) +
-- 2 responders — auth user + profile in one pass.
-- Names follow the dept: "Fire Dept Admin", "Fire Responder 1/2", …
-- Logins: deptadmin.<slug>@emergency.gov / deptadmin123
--         <slug>.responder<N>@emergency.gov / responder123
-- Run once in the Supabase SQL editor. Safe to re-run (skips existing
-- emails, upserts profiles). If a department is added later, re-run to
-- give it responders too.

DO $$
DECLARE
    d        RECORD;
    i        int;
    v_email  text;
    v_name   text;
    v_short  text;
    v_uid    uuid;
    v_made   int := 0;
BEGIN
    FOR d IN SELECT id, name FROM public.departments ORDER BY name LOOP
        -- "Fire Department" → "Fire"; "Emergency Medical Services" → "Emergency Medical Services"
        v_short := btrim(regexp_replace(d.name, '\mDepartment\M', '', 'i'));

        -- 1 dept admin — only when the department doesn't have one yet
        IF NOT EXISTS (
            SELECT 1 FROM public.user_profiles
            WHERE department_id = d.id AND role = 'department_admin'
        ) THEN
            v_email := 'deptadmin.'
                       || lower(regexp_replace(
                              regexp_replace(d.name, '\mDepartment\M', '', 'i'),
                              '[^a-zA-Z]+', '', 'g'))
                       || '@emergency.gov';
            v_name  := v_short || ' Dept Admin';

            SELECT id INTO v_uid FROM auth.users WHERE email = v_email;

            IF v_uid IS NULL THEN
                INSERT INTO auth.users (
                    instance_id, id, aud, role, email,
                    encrypted_password, email_confirmed_at,
                    confirmation_token, recovery_token, reauthentication_token,
                    email_change_token_new, email_change_token_current, email_change,
                    created_at, updated_at,
                    raw_app_meta_data, raw_user_meta_data
                ) VALUES (
                    '00000000-0000-0000-0000-000000000000',
                    gen_random_uuid(), 'authenticated', 'authenticated',
                    v_email,
                    crypt('deptadmin123', gen_salt('bf')),
                    now(),
                    '', '', '', '', '', '',
                    now(), now(),
                    '{"provider":"email","providers":["email"]}', '{}'
                )
                RETURNING id INTO v_uid;

                INSERT INTO auth.identities (
                    id, user_id, provider_id, identity_data,
                    provider, last_sign_in_at, created_at, updated_at
                ) VALUES (
                    gen_random_uuid(), v_uid, v_uid::text,
                    jsonb_build_object('sub', v_uid::text, 'email', v_email),
                    'email', now(), now(), now()
                );
                v_made := v_made + 1;
            END IF;

            INSERT INTO public.user_profiles
                (id, email, full_name, first_name, last_name, role, department_id, account_status, status)
            VALUES (
                v_uid, v_email, v_name, v_short, 'DeptAdmin',
                'department_admin', d.id, 'active', 'active'
            )
            ON CONFLICT (id) DO UPDATE SET
                role            = 'department_admin',
                department_id   = EXCLUDED.department_id,
                full_name       = EXCLUDED.full_name,
                account_status  = 'active',
                status          = 'active';
        END IF;

        FOR i IN 1..2 LOOP
            v_email := lower(regexp_replace(d.name, '\mDepartment\M', '', 'i'));
            v_email := lower(regexp_replace(v_email, '[^a-zA-Z]+', '', 'g'))
                       || '.responder' || i || '@emergency.gov';
            v_name  := v_short || ' Responder ' || i;

            SELECT id INTO v_uid FROM auth.users WHERE email = v_email;

            IF v_uid IS NULL THEN
                INSERT INTO auth.users (
                    instance_id, id, aud, role, email,
                    encrypted_password, email_confirmed_at,
                    confirmation_token, recovery_token, reauthentication_token,
                    email_change_token_new, email_change_token_current, email_change,
                    created_at, updated_at,
                    raw_app_meta_data, raw_user_meta_data
                ) VALUES (
                    '00000000-0000-0000-0000-000000000000',
                    gen_random_uuid(), 'authenticated', 'authenticated',
                    v_email,
                    crypt('responder123', gen_salt('bf')),
                    now(),
                    '', '', '', '', '', '',
                    now(), now(),
                    '{"provider":"email","providers":["email"]}', '{}'
                )
                RETURNING id INTO v_uid;

                INSERT INTO auth.identities (
                    id, user_id, provider_id, identity_data,
                    provider, last_sign_in_at, created_at, updated_at
                ) VALUES (
                    gen_random_uuid(), v_uid, v_uid::text,
                    jsonb_build_object('sub', v_uid::text, 'email', v_email),
                    'email', now(), now(), now()
                );
                v_made := v_made + 1;
            END IF;

            INSERT INTO public.user_profiles
                (id, email, full_name, first_name, last_name, role, department_id, account_status, status)
            VALUES (
                v_uid, v_email, v_name, v_short || ' Responder', i::text,
                'responder', d.id, 'active', 'active'
            )
            ON CONFLICT (id) DO UPDATE SET
                role            = 'responder',
                department_id   = EXCLUDED.department_id,
                full_name       = EXCLUDED.full_name,
                account_status  = 'active',
                status          = 'active';
        END LOOP;
    END LOOP;

    RAISE NOTICE 'seed: created % responder auth user(s)', v_made;
END $$;

-- Verify: every department should list 1 admin + 2 responders.
SELECT d.name AS department, p.email, p.full_name, p.role, p.account_status
FROM public.user_profiles p
JOIN public.departments d ON d.id = p.department_id
WHERE p.email LIKE '%.responder%@emergency.gov'
   OR p.email LIKE 'deptadmin.%@emergency.gov'
ORDER BY d.name, p.role DESC, p.email;
