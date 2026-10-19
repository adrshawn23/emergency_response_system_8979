-- Create ID verifications table for AI-assisted ID review
-- This enables user identity verification with human approval

CREATE TABLE IF NOT EXISTS public.id_verifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    id_document_url TEXT, -- URL to uploaded ID document
    ocr_data JSONB, -- Extracted data from OCR/AI analysis
    ocr_confidence DECIMAL(5,2), -- Confidence score from OCR (0-100)
    verification_status TEXT DEFAULT 'pending' CHECK (verification_status IN ('pending', 'under_review', 'approved', 'rejected', 'needs_clarity')),
    reviewed_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    review_notes TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_id_verifications_user_id ON public.id_verifications(user_id);
CREATE INDEX IF NOT EXISTS idx_id_verifications_status ON public.id_verifications(verification_status);
CREATE INDEX IF NOT EXISTS idx_id_verifications_created_at ON public.id_verifications(created_at DESC);

-- Enable RLS
ALTER TABLE public.id_verifications ENABLE ROW LEVEL SECURITY;

-- Policy: Users can read their own verifications
CREATE POLICY "Users can read own verifications" ON public.id_verifications
    FOR SELECT USING (auth.uid() = user_id);

-- Policy: Admins can read all verifications
CREATE POLICY "Admins can read all verifications" ON public.id_verifications
    FOR SELECT USING (public.is_admin());

-- Policy: Users can insert their own verifications
CREATE POLICY "Users can insert own verifications" ON public.id_verifications
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Policy: Admins can update verifications (for approval/rejection)
CREATE POLICY "Admins can update verifications" ON public.id_verifications
    FOR UPDATE USING (public.is_admin());

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_id_verification_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at
CREATE TRIGGER id_verification_updated_at
    BEFORE UPDATE ON public.id_verifications
    FOR EACH ROW
    EXECUTE FUNCTION public.update_id_verification_updated_at();
