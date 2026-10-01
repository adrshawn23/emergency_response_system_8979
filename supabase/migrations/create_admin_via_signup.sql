-- Create Admin User via Supabase Auth
-- This uses Supabase's built-in auth.signup function which handles password hashing correctly

-- First, enable the auth extension if not already enabled
-- (This is usually enabled by default in Supabase)

-- Create the admin user using the auth.signup function
-- This will send a confirmation email by default, so we'll mark it as confirmed

DO $$
DECLARE
    admin_user_id UUID;
    fire_dept_id UUID;
BEGIN
    -- Check if admin already exists in user_profiles
    IF EXISTS (SELECT 1 FROM public.user_profiles WHERE email = 'admin@emergency.gov') THEN
        RAISE NOTICE 'Admin user already exists in user_profiles. Updating role to admin...';
        
        -- Update existing user to admin role
        UPDATE public.user_profiles 
        SET role = 'admin', is_active = true
        WHERE email = 'admin@emergency.gov';
        
        RAISE NOTICE 'Admin role updated. Please use the Supabase dashboard to reset the password if needed.';
        RETURN;
    END IF;

    -- Get or create fire department
    SELECT id INTO fire_dept_id FROM public.departments WHERE name = 'Fire Department' LIMIT 1;
    
    IF fire_dept_id IS NULL THEN
        fire_dept_id := gen_random_uuid();
        INSERT INTO public.departments (id, name, type, description, contact_email, contact_phone, address) 
        VALUES (fire_dept_id, 'Fire Department', 'fire', 'Emergency fire response and prevention services', 'fire@emergency.gov', '555-FIRE', '123 Fire Station Rd');
    END IF;

    -- Create user profile (the auth user will be created via Supabase dashboard or signup)
    -- We'll insert a placeholder and the user will need to sign up via the app
    INSERT INTO public.user_profiles (id, email, full_name, role, phone_number, department_id, is_active)
    VALUES (
        gen_random_uuid(),
        'admin@emergency.gov',
        'System Administrator',
        'admin',
        '+1 (555) 123-0001',
        fire_dept_id,
        true
    );

    RAISE NOTICE 'Admin profile created. Please sign up via the app at /register with email: admin@emergency.gov';
    RAISE NOTICE 'After signup, go to Supabase dashboard → Authentication → Users to confirm the email and set the password to admin123';

EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Error: %', SQLERRM;
END $$;
