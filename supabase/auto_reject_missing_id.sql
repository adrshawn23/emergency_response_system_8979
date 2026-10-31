-- ============================================================
-- Auto-reject pending ID verifications that have no document
-- Run once in the Supabase SQL editor.
--
-- A pending row with no id_document_url and no storage path is a
-- registration whose ID upload never completed. After a 1h grace
-- (covers an in-flight upload) it is rejected automatically.
--
-- Two layers:
--   1. The admin residents queue sweeps on every load (already in
--      the app) — this script backfills existing rows now.
--   2. Optional pg_cron hourly sweep for true hands-off cleanup.
-- ============================================================

BEGIN;

-- Immediate sweep of existing bare pending rows (older than 1h).
UPDATE public.id_verifications
SET
    verification_status = 'rejected',
    review_notes = 'Auto-rejected: no ID document was submitted.'
WHERE verification_status = 'pending'
  AND id_document_url IS NULL
  AND document_storage_path IS NULL
  AND created_at < now() - interval '1 hour';

-- Optional: hourly sweep via pg_cron. Requires the pg_cron extension
-- (Supabase dashboard → Database → Extensions → pg_cron). If the
-- extension is unavailable this block logs a notice and continues —
-- the in-app sweep still keeps the queue clean.
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
        RAISE NOTICE 'pg_cron unavailable (%); skipping scheduled sweep — in-app sweep still applies.', SQLERRM;
    END;
END $$;

COMMIT;
