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
        INSERT INTO public.departments (name, type, description, contact_email, contact_phone, address)
        VALUES ('Fire Department', 'fire', 'Emergency fire response and prevention services', 'fire@emergency.gov', '09948270027', '456 Fire Station Rd, City')
        RETURNING id INTO fire_dept_id;
    END IF;

    -- Insert admin profile
    INSERT INTO public.user_profiles (id, email, full_name, role, status, department_id)
    VALUES (admin_uuid, 'admin@emergency.gov', 'System Administrator', 'admin', 'active', fire_dept_id);
    
    RAISE NOTICE 'Admin profile created successfully for user: admin@emergency.gov';
END $$;

-- Fix RLS policies for user_profiles (simplified to avoid circular dependency)
DROP POLICY IF EXISTS "Admins can manage all profiles" ON public.user_profiles;
DROP POLICY IF EXISTS "Allow users to read their profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Allow users to update their profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Users can view their own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "admin_view_all_profiles" ON public.user_profiles;
DROP POLICY IF EXISTS "admins_manage_all_user_profiles" ON public.user_profiles;
DROP POLICY IF EXISTS "users_manage_own_user_profiles" ON public.user_profiles;
DROP POLICY IF EXISTS "Users can read own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Admins can read all profiles" ON public.user_profiles;
DROP POLICY IF EXISTS "Admins can update all profiles" ON public.user_profiles;
DROP POLICY IF EXISTS "Admins can delete profiles" ON public.user_profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.user_profiles;

-- Simple policies: users can read/update their own profile
CREATE POLICY "Users can read own profile" ON public.user_profiles
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON public.user_profiles
    FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON public.user_profiles
    FOR INSERT WITH CHECK (auth.uid() = id);

-- Enable RLS
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
