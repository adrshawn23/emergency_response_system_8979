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
        INSERT INTO public.departments (name, description, status)
        VALUES ('Fire Department', 'Emergency fire response and prevention services', 'active')
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

-- Create test users for each role
-- Note: These users need to be created in auth.users first via Supabase Dashboard
-- Then their profiles will be created below

DO $$
DECLARE
    dispatcher_uuid UUID;
    responder_uuid UUID;
    resident_uuid UUID;
    fire_dept_id UUID;
    medical_dept_id UUID;
BEGIN
    -- Get department IDs
    SELECT id INTO fire_dept_id FROM public.departments WHERE name = 'Fire Department' LIMIT 1;
    SELECT id INTO medical_dept_id FROM public.departments WHERE name = 'Medical Services' LIMIT 1;
    
    -- Create Medical department if it doesn't exist
    IF medical_dept_id IS NULL THEN
        INSERT INTO public.departments (name, description, status)
        VALUES ('Medical Services', 'Emergency medical response and healthcare services', 'active')
        RETURNING id INTO medical_dept_id;
    END IF;

    -- Get user IDs from auth.users (create these users in Supabase Dashboard first)
    SELECT id INTO dispatcher_uuid FROM auth.users WHERE email = 'dispatcher@emergency.gov' LIMIT 1;
    SELECT id INTO responder_uuid FROM auth.users WHERE email = 'responder@emergency.gov' LIMIT 1;
    SELECT id INTO resident_uuid FROM auth.users WHERE email = 'resident@example.com' LIMIT 1;

    -- Create dispatcher profile
    IF dispatcher_uuid IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.user_profiles WHERE id = dispatcher_uuid) THEN
        INSERT INTO public.user_profiles (id, email, full_name, role, status, department_id)
        VALUES (dispatcher_uuid, 'dispatcher@emergency.gov', 'Test Dispatcher', 'dispatcher', 'active', fire_dept_id);
        RAISE NOTICE 'Dispatcher profile created';
    END IF;

    -- Create responder profile
    IF responder_uuid IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.user_profiles WHERE id = responder_uuid) THEN
        INSERT INTO public.user_profiles (id, email, full_name, role, status, department_id)
        VALUES (responder_uuid, 'responder@emergency.gov', 'Test Responder', 'responder', 'active', fire_dept_id);
        RAISE NOTICE 'Responder profile created';
    END IF;

    -- Create resident profile
    IF resident_uuid IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.user_profiles WHERE id = resident_uuid) THEN
        INSERT INTO public.user_profiles (id, email, full_name, role, status, department_id)
        VALUES (resident_uuid, 'resident@example.com', 'Test Resident', 'resident', 'active', NULL);
        RAISE NOTICE 'Resident profile created';
    END IF;

    RAISE NOTICE 'Test users setup complete. Create users in Supabase Dashboard with these emails:';
    RAISE NOTICE '- dispatcher@emergency.gov (password: dispatcher123)';
    RAISE NOTICE '- responder@emergency.gov (password: responder123)';
    RAISE NOTICE '- resident@example.com (password: resident123)';
END $$;

-- Create sample emergency reports for testing
DO $$
DECLARE
    reporter_id UUID;
BEGIN
    -- Get resident user ID as reporter
    SELECT id INTO reporter_id FROM public.user_profiles WHERE email = 'resident@example.com' LIMIT 1;
    
    IF reporter_id IS NULL THEN
        RAISE NOTICE 'Resident user not found. Skipping sample reports creation.';
        RETURN;
    END IF;

    -- Insert sample emergency reports
    INSERT INTO public.emergency_reports (report_id, incident_type, priority, status, location, coordinates, description, reporter_id, reporter_name, reporter_phone, created_at)
    VALUES 
        ('RPT-001', 'fire', 'high', 'pending', '123 Main Street, Kalubihan', '{"lat": 14.609, "lng": 121.022}', 'Fire reported in residential building. Smoke visible from second floor.', reporter_id, 'Test Resident', '09948270026', NOW() - INTERVAL '2 hours'),
        ('RPT-002', 'medical', 'critical', 'pending', '456 Market Ave, Kalubihan', '{"lat": 14.608, "lng": 121.023}', 'Person collapsed. Unconscious. Needs immediate medical attention.', reporter_id, 'Test Resident', '09948270026', NOW() - INTERVAL '1 hour'),
        ('RPT-003', 'accident', 'medium', 'pending', '789 Oak Street, Kalubihan', '{"lat": 14.610, "lng": 121.024}', 'Car accident at intersection. Two vehicles involved. Minor injuries reported.', reporter_id, 'Test Resident', '09948270026', NOW() - INTERVAL '30 minutes'),
        ('RPT-004', 'fire', 'low', 'assigned', '321 Pine Road, Kalubihan', '{"lat": 14.607, "lng": 121.021}', 'Small fire in trash bin. Contained but needs extinguishing.', reporter_id, 'Test Resident', '09948270026', NOW() - INTERVAL '4 hours');
    
    RAISE NOTICE 'Sample emergency reports created successfully';
END $$;
