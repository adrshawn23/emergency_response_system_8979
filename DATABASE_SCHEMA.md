# Database Schema Documentation

This document describes the database schema required for the Emergency Response System.

## Tables

### 1. user_profiles

Stores user profile information and role assignments.

```sql
CREATE TABLE user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  phone_number TEXT,
  address TEXT,
  role TEXT NOT NULL CHECK (role IN ('admin', 'dispatcher', 'responder', 'resident')),
  department_id UUID REFERENCES departments(id) ON DELETE SET NULL,
  is_active BOOLEAN DEFAULT true,
  avatar_url TEXT,
  requested_role TEXT CHECK (requested_role IN ('admin', 'dispatcher', 'responder', 'resident')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_user_profiles_role ON user_profiles(role);
CREATE INDEX idx_user_profiles_department ON user_profiles(department_id);
CREATE INDEX idx_user_profiles_is_active ON user_profiles(is_active);

-- Row Level Security Policies
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- Users can view their own profile
CREATE POLICY "Users can view own profile"
  ON user_profiles FOR SELECT
  USING (auth.uid() = id);

-- Admins can view all profiles
CREATE POLICY "Admins can view all profiles"
  ON user_profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Users can update their own profile
CREATE POLICY "Users can update own profile"
  ON user_profiles FOR UPDATE
  USING (auth.uid() = id);

-- Admins can update all profiles
CREATE POLICY "Admins can update all profiles"
  ON user_profiles FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );
```

### 2. departments

Organizes responders into departments.

```sql
CREATE TABLE departments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  parent_department_id UUID REFERENCES departments(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_departments_parent ON departments(parent_department_id);

-- Row Level Security Policies
ALTER TABLE departments ENABLE ROW LEVEL SECURITY;

-- All authenticated users can view departments
CREATE POLICY "Authenticated users can view departments"
  ON departments FOR SELECT
  USING (auth.role() = 'authenticated');

-- Only admins can insert departments
CREATE POLICY "Admins can insert departments"
  ON departments FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Only admins can update departments
CREATE POLICY "Admins can update departments"
  ON departments FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Only admins can delete departments
CREATE POLICY "Admins can delete departments"
  ON departments FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );
```

### 3. emergency_reports

Stores emergency incident reports.

```sql
CREATE TABLE emergency_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id TEXT UNIQUE NOT NULL,
  reporter_id UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  reporter_name TEXT NOT NULL,
  reporter_phone TEXT NOT NULL,
  incident_type TEXT NOT NULL CHECK (incident_type IN ('fire', 'medical', 'police', 'accident', 'natural', 'other')),
  location TEXT NOT NULL,
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  priority TEXT NOT NULL CHECK (priority IN ('critical', 'high', 'medium', 'low')),
  description TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'assigned', 'in-progress', 'resolved', 'declined')),
  assigned_to UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  assigned_department_id UUID REFERENCES departments(id) ON DELETE SET NULL,
  images TEXT[], -- Array of image URLs
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  resolved_at TIMESTAMP WITH TIME ZONE
);

-- Indexes
CREATE INDEX idx_emergency_reports_reporter ON emergency_reports(reporter_id);
CREATE INDEX idx_emergency_reports_status ON emergency_reports(status);
CREATE INDEX idx_emergency_reports_priority ON emergency_reports(priority);
CREATE INDEX idx_emergency_reports_assigned ON emergency_reports(assigned_to);
CREATE INDEX idx_emergency_reports_department ON emergency_reports(assigned_department_id);
CREATE INDEX idx_emergency_reports_created ON emergency_reports(created_at DESC);

-- Row Level Security Policies
ALTER TABLE emergency_reports ENABLE ROW LEVEL SECURITY;

-- Residents can view their own reports
CREATE POLICY "Residents can view own reports"
  ON emergency_reports FOR SELECT
  USING (
    reporter_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role IN ('admin', 'dispatcher', 'responder')
    )
  );

-- Admins, dispatchers, and responders can view all reports
CREATE POLICY "Emergency personnel can view all reports"
  ON emergency_reports FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role IN ('admin', 'dispatcher', 'responder')
    )
  );

-- Residents can insert reports
CREATE POLICY "Residents can insert reports"
  ON emergency_reports FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role IN ('resident', 'dispatcher', 'responder')
    )
  );

-- Dispatchers can update report status and assignment
CREATE POLICY "Dispatchers can update reports"
  ON emergency_reports FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role IN ('admin', 'dispatcher')
    )
  );

-- Responders can update their assigned reports
CREATE POLICY "Responders can update assigned reports"
  ON emergency_reports FOR UPDATE
  USING (
    assigned_to = auth.uid()
  );
```

### 4. emergency_contacts

Stores emergency contact information for users.

```sql
CREATE TABLE emergency_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  relationship TEXT NOT NULL,
  phone_number TEXT NOT NULL,
  is_primary BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_emergency_contacts_user ON emergency_contacts(user_id);
CREATE INDEX idx_emergency_contacts_primary ON emergency_contacts(user_id, is_primary);

-- Row Level Security Policies
ALTER TABLE emergency_contacts ENABLE ROW LEVEL SECURITY;

-- Users can view their own contacts
CREATE POLICY "Users can view own contacts"
  ON emergency_contacts FOR SELECT
  USING (user_id = auth.uid());

-- Users can insert their own contacts
CREATE POLICY "Users can insert own contacts"
  ON emergency_contacts FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Users can update their own contacts
CREATE POLICY "Users can update own contacts"
  ON emergency_contacts FOR UPDATE
  USING (user_id = auth.uid());

-- Users can delete their own contacts
CREATE POLICY "Users can delete own contacts"
  ON emergency_contacts FOR DELETE
  USING (user_id = auth.uid());
```

### 5. broadcasts

Stores emergency broadcasts sent to all users.

```sql
CREATE TABLE broadcasts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  broadcast_type TEXT NOT NULL CHECK (broadcast_type IN ('emergency', 'warning', 'info', 'test')),
  sender_id UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  sender_name TEXT NOT NULL,
  target_audience TEXT CHECK (target_audience IN ('all', 'residents', 'responders', 'dispatchers', 'admin')),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE
);

-- Indexes
CREATE INDEX idx_broadcasts_sender ON broadcasts(sender_id);
CREATE INDEX idx_broadcasts_active ON broadcasts(is_active);
CREATE INDEX idx_broadcasts_created ON broadcasts(created_at DESC);

-- Row Level Security Policies
ALTER TABLE broadcasts ENABLE ROW LEVEL SECURITY;

-- All authenticated users can view active broadcasts
CREATE POLICY "Authenticated users can view broadcasts"
  ON broadcasts FOR SELECT
  USING (auth.role() = 'authenticated');

-- Admins and dispatchers can insert broadcasts
CREATE POLICY "Admins and dispatchers can insert broadcasts"
  ON broadcasts FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role IN ('admin', 'dispatcher')
    )
  );

-- Admins and dispatchers can update broadcasts
CREATE POLICY "Admins and dispatchers can update broadcasts"
  ON broadcasts FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role IN ('admin', 'dispatcher')
    )
  );

-- Admins and dispatchers can delete broadcasts
CREATE POLICY "Admins and dispatchers can delete broadcasts"
  ON broadcasts FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role IN ('admin', 'dispatcher')
    )
  );
```

### 6. department_change_requests

Stores department change requests from responders.

```sql
CREATE TABLE department_change_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
  current_department_id UUID REFERENCES departments(id) ON DELETE SET NULL,
  requested_department_id UUID REFERENCES departments(id) ON DELETE SET NULL,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_department_change_requests_user ON department_change_requests(user_id);
CREATE INDEX idx_department_change_requests_status ON department_change_requests(status);

-- Row Level Security Policies
ALTER TABLE department_change_requests ENABLE ROW LEVEL SECURITY;

-- Users can view their own requests
CREATE POLICY "Users can view own requests"
  ON department_change_requests FOR SELECT
  USING (user_id = auth.uid());

-- Admins can view all requests
CREATE POLICY "Admins can view all requests"
  ON department_change_requests FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Users can insert their own requests
CREATE POLICY "Users can insert own requests"
  ON department_change_requests FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Admins can update requests
CREATE POLICY "Admins can update requests"
  ON department_change_requests FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );
```

## Storage Buckets

### report-images
- **Purpose:** Store images uploaded with emergency reports
- **Access:** Public (for viewing by authorized users)
- **File Types:** jpg, jpeg, png, webp
- **Max File Size:** 10MB

### id-documents
- **Purpose:** Store ID verification documents
- **Access:** Private (admin access only)
- **File Types:** jpg, jpeg, png, webp, pdf
- **Max File Size:** 5MB

## Functions and Triggers

### Updated At Trigger
```sql
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply to tables
CREATE TRIGGER update_user_profiles_updated_at BEFORE UPDATE ON user_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_departments_updated_at BEFORE UPDATE ON departments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_emergency_reports_updated_at BEFORE UPDATE ON emergency_reports
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

### Report ID Generator
```sql
CREATE OR REPLACE FUNCTION generate_report_id()
RETURNS TEXT AS $$
BEGIN
  RETURN 'REP-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || LPAD(nextval('report_seq')::TEXT, 4, '0');
END;
$$ LANGUAGE plpgsql;

CREATE SEQUENCE report_seq START 1;
```

## Initial Data

### Default Departments
```sql
INSERT INTO departments (name, description) VALUES
('Fire Department', 'Firefighting and rescue operations'),
('Police Department', 'Law enforcement and public safety'),
('Medical Services', 'Emergency medical response'),
('Hazmat Response', 'Hazardous materials handling'),
('Administration', 'System administration and oversight');
```

### Default Admin User (after auth signup)
```sql
-- This should be done manually after the first admin signs up
UPDATE user_profiles 
SET role = 'admin', is_active = true 
WHERE email = 'admin@example.com';
```

## Notes

- All tables use UUIDs for primary keys
- Row Level Security (RLS) is enabled on all tables
- Foreign key constraints ensure data integrity
- Indexes are created for frequently queried columns
- Timestamps use UTC timezone
- The schema follows Supabase/PostgreSQL best practices

## Migration Steps

1. Run the SQL above in your Supabase SQL editor
2. Create storage buckets in Supabase Storage
3. Set up storage policies for bucket access
4. Insert initial data (departments, etc.)
5. Create the first admin user via the registration flow
6. Manually promote the first user to admin role in the database
