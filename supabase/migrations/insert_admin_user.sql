-- Insert Admin User Only
-- Run this if you already have the database schema set up but need the admin account

DO $$
DECLARE
    admin_uuid UUID := gen_random_uuid();
    fire_dept_id UUID;
BEGIN
    -- Check if admin user already exists
    IF EXISTS (SELECT 1 FROM auth.users WHERE email = 'admin@emergency.gov') THEN
        RAISE NOTICE 'Admin user already exists. Skipping creation.';
        RETURN;
    END IF;

    -- Get or create fire department
    SELECT id INTO fire_dept_id FROM public.departments WHERE name = 'Fire Department' LIMIT 1;
    
    IF fire_dept_id IS NULL THEN
        fire_dept_id := gen_random_uuid();
        INSERT INTO public.departments (id, name, type, description, contact_email, contact_phone, address) 
        VALUES (fire_dept_id, 'Fire Department', 'fire', 'Emergency fire response and prevention services', 'fire@emergency.gov', '555-FIRE', '123 Fire Station Rd');
    END IF;

    -- Create auth user for admin
    INSERT INTO auth.users (
        id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
        created_at, updated_at, raw_user_meta_data, raw_app_meta_data,
        is_sso_user, is_anonymous, confirmation_token, confirmation_sent_at,
        recovery_token, recovery_sent_at, email_change_token_new, email_change,
        email_change_sent_at, email_change_token_current, email_change_confirm_status,
        reauthentication_token, reauthentication_sent_at, phone, phone_change,
        phone_change_token, phone_change_sent_at
    ) VALUES
        (admin_uuid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
         'admin@emergency.gov', crypt('admin123', gen_salt('bf', 10)), now(), now(), now(),
         '{"full_name": "System Administrator", "role": "admin"}'::jsonb, '{"provider": "email", "providers": ["email"]}'::jsonb,
         false, false, '', null, '', null, '', '', null, '', 0, '', null, null, '', '', null);

    -- Create user profile (trigger should handle this, but we'll ensure it's correct)
    INSERT INTO public.user_profiles (id, email, full_name, role, phone_number, department_id, is_active)
    VALUES (admin_uuid, 'admin@emergency.gov', 'System Administrator', 'admin', '+1 (555) 123-0001', fire_dept_id, true)
    ON CONFLICT (id) DO UPDATE SET
        role = 'admin',
        department_id = fire_dept_id,
        phone_number = '+1 (555) 123-0001';

    RAISE NOTICE 'Admin user created successfully: admin@emergency.gov / admin123';

EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Error creating admin user: %', SQLERRM;
END $$;
