-- Auto-reject pending ID verifications with no document.
-- Keep in sync with supabase/auto_reject_missing_id.sql.
--
-- Pending rows with no id_document_url and no storage path come from
-- registrations whose ID upload never completed. A 1h grace period
-- covers an in-flight upload before the row is rejected.

UPDATE public.id_verifications
SET
    verification_status = 'rejected',
    review_notes = 'Auto-rejected: no ID document was submitted.'
WHERE verification_status = 'pending'
  AND id_document_url IS NULL
  AND document_storage_path IS NULL
  AND created_at < now() - interval '1 hour';

-- Optional hourly sweep when pg_cron is available.
DO $$
BEGIN
    BEGIN
        PERFORM cron.schedule(
            'auto-reject-missing-id',
            '15 * * * *',
            $sql$
                UPDATE public.id_verifications
                SET
                    verification_status = 'rejected',
                    review_notes = 'Auto-rejected: no ID document was submitted.'
                WHERE verification_status = 'pending'
                  AND id_document_url IS NULL
                  AND document_storage_path IS NULL
                  AND created_at < now() - interval '1 hour';
            $sql$
        );
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'pg_cron unavailable (%); skipping scheduled sweep.', SQLERRM;
    END;
END $$;
