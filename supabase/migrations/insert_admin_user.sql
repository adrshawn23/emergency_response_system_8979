-- Insert Admin User Profile Only
-- NOTE: This script only creates the user profile. The auth user must be created via Supabase Dashboard or API first.
-- 
-- Steps to create admin user:
-- 1. Go to Supabase Dashboard → Authentication → Users
-- 2. Click "Add user" and create user with email: admin@emergency.gov
-- 3. Set password and enable "Auto Confirm User"
-- 4. After creating the user, run this script to set up their profile

DO $$
DECLARE
    admin_uuid UUID;
    fire_dept_id UUID;
BEGIN
    -- Get admin user ID from auth.users (user must be created first)
    SELECT id INTO admin_uuid FROM auth.users WHERE email = 'admin@emergency.gov' LIMIT 1;
    
    IF admin_uuid IS NULL THEN
        RAISE NOTICE 'Admin user not found in auth.users. Please create the user via Supabase Dashboard first.';
        RETURN;
    END IF;

    -- Check if profile already exists
    IF EXISTS (SELECT 1 FROM public.user_profiles WHERE id = admin_uuid) THEN
        RAISE NOTICE 'Admin profile already exists. Skipping creation.';
        RETURN;
    END IF;

    -- Get or create fire department
    SELECT id INTO fire_dept_id FROM public.departments WHERE name = 'Fire Department' LIMIT 1;
    
    IF fire_dept_id IS NULL THEN
        fire_dept_id := gen_random_uuid();
        INSERT INTO public.departments (id, name, type, description, contact_email, contact_phone, address) 
        VALUES (fire_dept_id, 'Fire Department', 'fire', 'Emergency fire response and prevention services', 'fire@emergency.gov', '09948270026', '123 Fire Station Rd');
    END IF;

    -- Create user profile for admin
    INSERT INTO public.user_profiles (id, email, full_name, role, phone_number, department_id, is_active)
    VALUES (admin_uuid, 'admin@emergency.gov', 'System Administrator', 'admin', '09948270026', fire_dept_id, true)
    ON CONFLICT (id) DO UPDATE SET
        role = 'admin',
        department_id = fire_dept_id,
        phone_number = '09948270026';

    RAISE NOTICE 'Admin profile created successfully for: admin@emergency.gov';

EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Error creating admin profile: %', SQLERRM;
END $$;
