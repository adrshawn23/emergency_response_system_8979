-- Private ID-document storage + retention.
--
-- ID images live ONLY in the private 'id-documents' bucket behind RLS —
-- never in auth metadata, public buckets, or logs. Paths are unpredictable
-- (<user uuid>/<random uuid>) and reviewers get short-lived signed URLs.
--
-- NOTE: storage.buckets/objects only exist in Supabase-hosted projects.
-- This migration is a no-op outside Supabase (guarded by schema check).

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'storage') THEN
    INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    VALUES (
      'id-documents', 'id-documents', false,
      5242880,                                       -- 5 MB cap
      ARRAY['image/jpeg', 'image/png', 'image/webp'] -- raster only
    )
    ON CONFLICT (id) DO UPDATE SET
      public = false,
      file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

    -- Public avatar bucket (headers/sidebars show these for every role).
    INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    VALUES ('avatars', 'avatars', true, 2097152,
            ARRAY['image/jpeg', 'image/png', 'image/webp'])
    ON CONFLICT (id) DO UPDATE SET public = true;
  END IF;
END $$;

-- storage.objects policies — owner writes own path, only admins read.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'storage') THEN
    EXECUTE 'DROP POLICY IF EXISTS "users_upload_own_id_document" ON storage.objects';
    EXECUTE 'CREATE POLICY "users_upload_own_id_document" ON storage.objects
      FOR INSERT TO authenticated
      WITH CHECK (
        bucket_id = ''id-documents''
        AND (storage.foldername(name))[1] = auth.uid()::text
      )';

    EXECUTE 'DROP POLICY IF EXISTS "users_read_own_id_document" ON storage.objects';
    EXECUTE 'CREATE POLICY "users_read_own_id_document" ON storage.objects
      FOR SELECT TO authenticated
      USING (
        bucket_id = ''id-documents''
        AND (storage.foldername(name))[1] = auth.uid()::text
      )';

    EXECUTE 'DROP POLICY IF EXISTS "admins_read_id_documents" ON storage.objects';
    EXECUTE 'CREATE POLICY "admins_read_id_documents" ON storage.objects
      FOR SELECT TO authenticated
      USING (bucket_id = ''id-documents'' AND public.is_admin())';

    EXECUTE 'DROP POLICY IF EXISTS "users_update_own_id_document" ON storage.objects';
    EXECUTE 'CREATE POLICY "users_update_own_id_document" ON storage.objects
      FOR UPDATE TO authenticated
      USING (
        bucket_id = ''id-documents''
        AND (storage.foldername(name))[1] = auth.uid()::text
      )';

    -- Avatars: users may only write inside their own folder; reads are public
    -- via the public bucket itself.
    EXECUTE 'DROP POLICY IF EXISTS "users_write_own_avatar" ON storage.objects';
    EXECUTE 'CREATE POLICY "users_write_own_avatar" ON storage.objects
      FOR INSERT TO authenticated
      WITH CHECK (
        bucket_id = ''avatars''
        AND (storage.foldername(name))[1] = auth.uid()::text
      )';

    EXECUTE 'DROP POLICY IF EXISTS "users_update_own_avatar" ON storage.objects';
    EXECUTE 'CREATE POLICY "users_update_own_avatar" ON storage.objects
      FOR UPDATE TO authenticated
      USING (
        bucket_id = ''avatars''
        AND (storage.foldername(name))[1] = auth.uid()::text
      )';
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- Retention: reviewed documents 7 days, unreviewed 30 days (proposed policy —
-- confirm with admin before enabling the cron schedule).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.purge_reviewed_id_documents(
  p_reviewed_days integer DEFAULT 7,
  p_unreviewed_days integer DEFAULT 30
)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_count integer := 0;
  v_row record;
BEGIN
  FOR v_row IN
    SELECT id, document_storage_path
    FROM public.id_verifications
    WHERE document_storage_path IS NOT NULL
      AND (
        (decision_at IS NOT NULL AND decision_at < now() - make_interval(days => p_reviewed_days))
        OR (decision_at IS NULL AND created_at < now() - make_interval(days => p_unreviewed_days))
      )
  LOOP
    BEGIN
      DELETE FROM storage.objects
      WHERE bucket_id = 'id-documents' AND name = v_row.document_storage_path;

      UPDATE public.id_verifications
      SET document_storage_path = NULL,
          review_notes = COALESCE(review_notes, '') || ' [document purged per retention policy]'
      WHERE id = v_row.id;

      INSERT INTO public.audit_logs (actor_id, user_id, action, record_type, table_name, record_id, reason, created_at)
      VALUES (NULL, NULL, 'retention_purge', 'id_verifications', 'id_verifications', v_row.id,
              format('ID document purged (policy: reviewed %sd / unreviewed %sd)', p_reviewed_days, p_unreviewed_days), now());
      v_count := v_count + 1;
    EXCEPTION WHEN OTHERS THEN
      -- Retry next run; log the failure for operators.
      INSERT INTO public.audit_logs (actor_id, user_id, action, record_type, table_name, record_id, reason, created_at)
      VALUES (NULL, NULL, 'retention_purge_failed', 'id_verifications', 'id_verifications', v_row.id, SQLERRM, now());
    END;
  END LOOP;
  RETURN v_count;
END;
$$;

-- Orphan cleanup: storage objects older than retention with no matching
-- verification row are deleted.
CREATE OR REPLACE FUNCTION public.purge_orphan_id_documents(p_days integer DEFAULT 30)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_count integer := 0;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'storage') THEN
    RETURN 0;
  END IF;

  DELETE FROM storage.objects o
  WHERE o.bucket_id = 'id-documents'
    AND o.created_at < now() - make_interval(days => p_days)
    AND NOT EXISTS (
      SELECT 1 FROM public.id_verifications v WHERE v.document_storage_path = o.name
    );
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- Schedule nightly purges IF pg_cron is available. Wrapped so the migration
-- succeeds on projects without the extension.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.schedule('purge-id-documents', '0 3 * * *',
      'SELECT public.purge_reviewed_id_documents(); SELECT public.purge_orphan_id_documents();');
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'pg_cron unavailable — schedule purge_reviewed_id_documents() via dashboard cron or edge scheduler: %', SQLERRM;
END $$;
