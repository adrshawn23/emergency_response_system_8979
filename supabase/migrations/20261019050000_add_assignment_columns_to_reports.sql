-- Add assignment columns to emergency_reports table
-- These columns enable dispatcher to assign incidents to responders and departments

ALTER TABLE public.emergency_reports 
ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS assigned_department_id UUID REFERENCES public.departments(id) ON DELETE SET NULL;
