-- Fix emergency_reports table schema: Add missing report_id and status columns
-- These columns are required for incident tracking and status updates.

ALTER TABLE public.emergency_reports 
ADD COLUMN IF NOT EXISTS report_id TEXT;

-- We add status with a default value. 
-- Assuming report_status enum exists from the initial migration.
ALTER TABLE public.emergency_reports 
ADD COLUMN IF NOT EXISTS status public.report_status DEFAULT 'pending'::public.report_status;

-- If report_id was missing and is now added, we should ideally populate it.
-- However, without knowing the format, we'll leave it NULL for now 
-- and let the application logic handle it.
-- We can enforce NOT NULL later if required.
