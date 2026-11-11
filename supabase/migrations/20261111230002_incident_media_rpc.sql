-- incident_media — evidence photos + resolution proof for the shared
-- detail modal when the caller can't read the full report row.
--
-- public_incidents strips media (multi-MB base64) to keep the feed light,
-- and residents_view_own_reports blocks direct emergency_reports reads for
-- non-reporters — so a resident opening someone else's incident from
-- Today's incidents saw no photos at all.
--
-- This RPC returns ONLY the media keys — contact_name/contact_phone stay
-- behind the table's RLS. SECURITY DEFINER is intentional: media is part of
-- the public incident view the barangay wants residents to see.
--
-- Apply via Supabase SQL editor.

BEGIN;

CREATE OR REPLACE FUNCTION public.incident_media(p_report_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
    RETURN (
        SELECT jsonb_build_object(
            'images',           attachments->'images',
            'resolution_proof', attachments->'resolution_proof'
        )
        FROM public.emergency_reports
        WHERE id = p_report_id
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.incident_media(uuid) TO authenticated;

COMMIT;
