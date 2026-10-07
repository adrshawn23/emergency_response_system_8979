-- Emergency Response System Database Migration
-- Schema Analysis: No existing schema - creating complete emergency management database
-- Integration Type: Complete schema creation with authentication and RLS policies
-- Dependencies: auth.users (Supabase managed)

-- 1. ENUMS AND TYPES (with error handling for existing types)
DO $$
BEGIN
    -- Create enums if they don't exist
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
        CREATE TYPE public.user_role AS ENUM ('admin', 'dispatcher', 'responder', 'resident');
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'incident_type') THEN
        CREATE TYPE public.incident_type AS ENUM ('fire', 'medical', 'police', 'accident', 'natural');
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'priority_level') THEN
        CREATE TYPE public.priority_level AS ENUM ('low', 'medium', 'high', 'critical');
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'report_status') THEN
        CREATE TYPE public.report_status AS ENUM ('pending', 'assigned', 'in-progress', 'resolved', 'declined');
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'department_type') THEN
        CREATE TYPE public.department_type AS ENUM ('fire', 'medical', 'police', 'emergency_management');
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Error creating types: %', SQLERRM;
END $$;

-- 2. CORE TABLES (No foreign keys first)

-- User profiles table (intermediary for auth.users)
CREATE TABLE IF NOT EXISTS public.user_profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL UNIQUE,
    full_name TEXT NOT NULL,
    phone_number TEXT,
    role public.user_role DEFAULT 'resident'::public.user_role,
    department_id UUID,
    is_active BOOLEAN DEFAULT true,
    avatar_url TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Departments table
CREATE TABLE IF NOT EXISTS public.departments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    type public.department_type NOT NULL,
    description TEXT,
    contact_email TEXT,
    contact_phone TEXT,
    address TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Emergency reports table
CREATE TABLE IF NOT EXISTS public.emergency_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    report_id TEXT NOT NULL UNIQUE, -- RPT-001 format
    incident_type public.incident_type NOT NULL,
    priority public.priority_level NOT NULL,
    status public.report_status DEFAULT 'pending'::public.report_status,
    location TEXT NOT NULL,
    coordinates JSONB, -- {lat: number, lng: number}
    description TEXT NOT NULL,
    reporter_id UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    reporter_name TEXT NOT NULL,
    reporter_phone TEXT NOT NULL,
    assigned_to UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    assigned_department_id UUID REFERENCES public.departments(id) ON DELETE SET NULL,
    images TEXT[], -- Array of image URLs
    decline_reason TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    resolved_at TIMESTAMPTZ
);

-- 3. DEPENDENT TABLES (With foreign keys to existing tables)

-- Add department foreign key to user_profiles
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'fk_user_profiles_department'
    ) THEN
        ALTER TABLE public.user_profiles 
        ADD CONSTRAINT fk_user_profiles_department 
        FOREIGN KEY (department_id) REFERENCES public.departments(id) ON DELETE SET NULL;
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Error adding foreign key: %', SQLERRM;
END $$;

-- Report updates/notes table
CREATE TABLE IF NOT EXISTS public.report_updates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    report_id UUID REFERENCES public.emergency_reports(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    update_type TEXT NOT NULL, -- 'status_change', 'assignment', 'note', 'location_update'
    message TEXT NOT NULL,
    old_status public.report_status,
    new_status public.report_status,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Emergency contacts table
CREATE TABLE IF NOT EXISTS public.emergency_contacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    relationship TEXT NOT NULL,
    phone_number TEXT NOT NULL,
    is_primary BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 4. INDEXES
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_user_profiles_role') THEN
        CREATE INDEX idx_user_profiles_role ON public.user_profiles(role);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_user_profiles_department') THEN
        CREATE INDEX idx_user_profiles_department ON public.user_profiles(department_id);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_departments_type') THEN
        CREATE INDEX idx_departments_type ON public.departments(type);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_emergency_reports_status') THEN
        CREATE INDEX idx_emergency_reports_status ON public.emergency_reports(status);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_emergency_reports_priority') THEN
        CREATE INDEX idx_emergency_reports_priority ON public.emergency_reports(priority);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_emergency_reports_incident_type') THEN
        CREATE INDEX idx_emergency_reports_incident_type ON public.emergency_reports(incident_type);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_emergency_reports_reporter') THEN
        CREATE INDEX idx_emergency_reports_reporter ON public.emergency_reports(reporter_id);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_emergency_reports_assigned_to') THEN
        CREATE INDEX idx_emergency_reports_assigned_to ON public.emergency_reports(assigned_to);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_emergency_reports_created_at') THEN
        CREATE INDEX idx_emergency_reports_created_at ON public.emergency_reports(created_at DESC);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_report_updates_report_id') THEN
        CREATE INDEX idx_report_updates_report_id ON public.report_updates(report_id);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_emergency_contacts_user_id') THEN
        CREATE INDEX idx_emergency_contacts_user_id ON public.emergency_contacts(user_id);
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Error creating indexes: %', SQLERRM;
END $$;

-- 5. FUNCTIONS (Before RLS policies)

-- Function to generate report ID
CREATE OR REPLACE FUNCTION public.generate_report_id()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    next_number INTEGER;
    report_id TEXT;
BEGIN
    -- Get the next sequential number
    SELECT COALESCE(MAX(CAST(SUBSTRING(report_id FROM 5) AS INTEGER)), 0) + 1
    INTO next_number
    FROM public.emergency_reports
    WHERE report_id LIKE 'RPT-%';
    
    -- Format as RPT-XXX
    report_id := 'RPT-' || LPAD(next_number::TEXT, 3, '0');
    
    RETURN report_id;
END;
$$;

-- Function to handle new user registration
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    INSERT INTO public.user_profiles (id, email, full_name, role)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
        COALESCE(NEW.raw_user_meta_data->>'role', 'resident')::public.user_role
    );
    RETURN NEW;
END;
$$;

-- Function to update report timestamps
CREATE OR REPLACE FUNCTION public.update_report_timestamp()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    
    -- Set resolved_at when status changes to resolved
    IF NEW.status = 'resolved' AND OLD.status != 'resolved' THEN
        NEW.resolved_at = CURRENT_TIMESTAMP;
    END IF;
    
    RETURN NEW;
END;
$$;

-- Trigger to auto-generate report ID
CREATE OR REPLACE FUNCTION public.auto_generate_report_id()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.report_id IS NULL OR NEW.report_id = '' THEN
        NEW.report_id = public.generate_report_id();
    END IF;
    RETURN NEW;
END;
$$;

-- 6. ENABLE RLS
DO $$
BEGIN
    ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.emergency_reports ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.report_updates ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.emergency_contacts ENABLE ROW LEVEL SECURITY;
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Error enabling RLS: %', SQLERRM;
END $$;

-- 7. RLS POLICIES (with IF NOT EXISTS checks)

-- Drop existing policies if they exist
DO $$
BEGIN
    DROP POLICY IF EXISTS "users_manage_own_user_profiles" ON public.user_profiles;
    DROP POLICY IF EXISTS "admin_view_all_profiles" ON public.user_profiles;
    DROP POLICY IF EXISTS "public_can_read_departments" ON public.departments;
    DROP POLICY IF EXISTS "admin_manage_departments" ON public.departments;
    DROP POLICY IF EXISTS "residents_manage_own_reports" ON public.emergency_reports;
    DROP POLICY IF EXISTS "staff_view_all_reports" ON public.emergency_reports;
    DROP POLICY IF EXISTS "staff_update_reports" ON public.emergency_reports;
    DROP POLICY IF EXISTS "users_manage_own_report_updates" ON public.report_updates;
    DROP POLICY IF EXISTS "users_manage_own_emergency_contacts" ON public.emergency_contacts;
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Error dropping policies: %', SQLERRM;
END $$;

-- User profiles policies (Pattern 1 - Core user table)
CREATE POLICY "users_manage_own_user_profiles"
ON public.user_profiles
FOR ALL
TO authenticated
USING (id = auth.uid())
WITH CHECK (id = auth.uid());

-- Admin can view all profiles
CREATE POLICY "admin_view_all_profiles"
ON public.user_profiles
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM auth.users au
        WHERE au.id = auth.uid() 
        AND au.raw_user_meta_data->>'role' = 'admin'
    )
);

-- Departments policies - Public read, admin manage
CREATE POLICY "public_can_read_departments"
ON public.departments
FOR SELECT
TO public
USING (true);

CREATE POLICY "admin_manage_departments"
ON public.departments
FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM auth.users au
        WHERE au.id = auth.uid() 
        AND au.raw_user_meta_data->>'role' = 'admin'
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM auth.users au
        WHERE au.id = auth.uid() 
        AND au.raw_user_meta_data->>'role' = 'admin'
    )
);

-- Emergency reports policies
-- Residents can create and view their own reports
CREATE POLICY "residents_manage_own_reports"
ON public.emergency_reports
FOR ALL
TO authenticated
USING (reporter_id = auth.uid())
WITH CHECK (reporter_id = auth.uid());

-- Staff can view all reports
CREATE POLICY "staff_view_all_reports"
ON public.emergency_reports
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.user_profiles up
        WHERE up.id = auth.uid() 
        AND up.role IN ('admin', 'dispatcher', 'responder')
    )
);

-- Staff can update reports
CREATE POLICY "staff_update_reports"
ON public.emergency_reports
FOR UPDATE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.user_profiles up
        WHERE up.id = auth.uid() 
        AND up.role IN ('admin', 'dispatcher', 'responder')
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.user_profiles up
        WHERE up.id = auth.uid() 
        AND up.role IN ('admin', 'dispatcher', 'responder')
    )
);

-- Report updates policies
CREATE POLICY "users_manage_own_report_updates"
ON public.report_updates
FOR ALL
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Emergency contacts policies
CREATE POLICY "users_manage_own_emergency_contacts"
ON public.emergency_contacts
FOR ALL
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- 8. TRIGGERS (with IF NOT EXISTS checks)
DO $$
BEGIN
    DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
    DROP TRIGGER IF EXISTS update_emergency_reports_timestamp ON public.emergency_reports;
    DROP TRIGGER IF EXISTS generate_report_id_trigger ON public.emergency_reports;
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Error dropping triggers: %', SQLERRM;
END $$;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE TRIGGER update_emergency_reports_timestamp
    BEFORE UPDATE ON public.emergency_reports
    FOR EACH ROW EXECUTE FUNCTION public.update_report_timestamp();

CREATE TRIGGER generate_report_id_trigger
    BEFORE INSERT ON public.emergency_reports
    FOR EACH ROW EXECUTE FUNCTION public.auto_generate_report_id();

-- 9. MOCK DATA (Public tables only - auth users must be created via Supabase Dashboard)
DO $$
DECLARE
    fire_dept_id UUID := gen_random_uuid();
    police_dept_id UUID := gen_random_uuid();
    medical_dept_id UUID := gen_random_uuid();
    report1_id UUID := gen_random_uuid();
    report2_id UUID := gen_random_uuid();
    report3_id UUID := gen_random_uuid();
    -- These UUIDs should match actual auth users created via Supabase Dashboard
    -- Replace with actual UUIDs after creating users
    admin_uuid UUID := '00000000-0000-0000-0000-000000000000'::UUID;
    dispatcher_uuid UUID := '00000000-0000-0000-0000-000000000001'::UUID;
    responder_uuid UUID := '00000000-0000-0000-0000-000000000002'::UUID;
    resident_uuid UUID := '00000000-0000-0000-0000-000000000003'::UUID;
BEGIN
    -- Create departments
    INSERT INTO public.departments (id, name, type, description, contact_email, contact_phone, address) VALUES
        (fire_dept_id, 'Fire Department', 'fire', 'Emergency fire response and prevention services', 'fire@emergency.gov', '555-FIRE', '123 Fire Station Rd'),
        (police_dept_id, 'Police Department', 'police', 'Law enforcement and public safety', 'police@emergency.gov', '555-POLICE', '456 Police Plaza'),
        (medical_dept_id, 'Emergency Medical Services', 'medical', 'Emergency medical response and ambulance services', 'ems@emergency.gov', '555-MEDIC', '789 Hospital Way');

    -- Create user profiles (only if auth users exist)
    -- Skip if placeholder UUIDs are used
    IF admin_uuid::text != '00000000-0000-0000-0000-000000000000' THEN
        INSERT INTO public.user_profiles (id, email, full_name, role, phone_number, department_id, is_active)
        VALUES (admin_uuid, 'admin@emergency.gov', 'System Administrator', 'admin', '+1 (555) 123-0001', fire_dept_id, true)
        ON CONFLICT (id) DO UPDATE SET phone_number = '+1 (555) 123-0001', department_id = fire_dept_id;
    END IF;

    IF dispatcher_uuid::text != '00000000-0000-0000-0000-000000000001' THEN
        INSERT INTO public.user_profiles (id, email, full_name, role, phone_number, department_id, is_active)
        VALUES (dispatcher_uuid, 'dispatcher@emergency.gov', 'Emergency Dispatcher', 'dispatcher', '+1 (555) 123-0002', police_dept_id, true)
        ON CONFLICT (id) DO UPDATE SET phone_number = '+1 (555) 123-0002', department_id = police_dept_id;
    END IF;

    IF responder_uuid::text != '00000000-0000-0000-0000-000000000002' THEN
        INSERT INTO public.user_profiles (id, email, full_name, role, phone_number, department_id, is_active)
        VALUES (responder_uuid, 'responder@emergency.gov', 'First Responder', 'responder', '+1 (555) 123-0003', fire_dept_id, true)
        ON CONFLICT (id) DO UPDATE SET phone_number = '+1 (555) 123-0003', department_id = fire_dept_id;
    END IF;

    IF resident_uuid::text != '00000000-0000-0000-0000-000000000003' THEN
        INSERT INTO public.user_profiles (id, email, full_name, role, phone_number, is_active)
        VALUES (resident_uuid, 'resident@community.com', 'Community Resident', 'resident', '+1 (555) 123-0004', true)
        ON CONFLICT (id) DO UPDATE SET phone_number = '+1 (555) 123-0004';
    END IF;

    -- Create emergency reports (using resident_uuid if it exists, otherwise skip)
    IF resident_uuid::text != '00000000-0000-0000-0000-000000000003' THEN
        INSERT INTO public.emergency_reports (
            id, incident_type, priority, status, location, coordinates, description,
            reporter_id, reporter_name, reporter_phone, assigned_to, assigned_department_id, images
        ) VALUES
            (report1_id, 'fire', 'critical', 'pending', '123 Main Street, Downtown',
             '{"lat": 40.7128, "lng": -74.0060}'::jsonb,
             'Large fire reported at residential building. Multiple residents trapped on upper floors. Heavy smoke visible from street level.',
             resident_uuid, 'John Smith', '+1 (555) 123-4567', NULL, fire_dept_id,
             ARRAY['https://images.unsplash.com/photo-1574869711319-2a4b1d2b3c5c?w=400']),
            (report2_id, 'medical', 'high', 'assigned', '456 Oak Avenue, Midtown',
             '{"lat": 40.7589, "lng": -73.9851}'::jsonb,
             'Elderly person collapsed at home. Conscious but experiencing chest pain and difficulty breathing.',
             resident_uuid, 'Sarah Johnson', '+1 (555) 234-5678', responder_uuid, medical_dept_id,
             ARRAY[]::TEXT[]),
            (report3_id, 'accident', 'high', 'resolved', '321 Elm Street, Southside',
             '{"lat": 40.7282, "lng": -73.9942}'::jsonb,
             'Multi-vehicle accident at busy intersection. Two cars involved with possible injuries.',
             resident_uuid, 'Lisa Chen', '+1 (555) 456-7890', responder_uuid, police_dept_id,
             ARRAY[]::TEXT[]);

        -- Add emergency contacts
        INSERT INTO public.emergency_contacts (user_id, name, relationship, phone_number, is_primary) VALUES
            (resident_uuid, 'Mary Smith', 'Spouse', '+1 (555) 987-6543', true),
            (resident_uuid, 'David Smith', 'Son', '+1 (555) 876-5432', false);

        -- Add report updates
        INSERT INTO public.report_updates (report_id, user_id, update_type, message, old_status, new_status) VALUES
            (report2_id, dispatcher_uuid, 'assignment', 'Assigned to paramedic team', 'pending', 'assigned'),
            (report3_id, responder_uuid, 'status_change', 'Scene secured and cleared', 'in-progress', 'resolved');
    END IF;

    RAISE NOTICE 'Mock data created successfully. Note: Auth users must be created via Supabase Dashboard first.';

EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Error creating mock data: %', SQLERRM;
END $$;