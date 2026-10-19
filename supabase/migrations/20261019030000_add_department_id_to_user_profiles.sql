-- Add department_id column to user_profiles for department assignment
-- This column links users to their assigned departments

ALTER TABLE public.user_profiles 
ADD COLUMN IF NOT EXISTS department_id UUID REFERENCES public.departments(id) ON DELETE SET NULL;
