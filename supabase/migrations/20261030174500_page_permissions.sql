-- Editable page permissions (RBAC matrix).
-- Keep in sync with supabase/page_permissions.sql.

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.user_profiles
        WHERE id = auth.uid() AND role = 'admin'
    );
$$;

CREATE TABLE IF NOT EXISTS public.page_permissions (
    page_key      text PRIMARY KEY,
    allowed_roles text[] NOT NULL DEFAULT '{}'
);

ALTER TABLE public.page_permissions ENABLE ROW LEVEL SECURITY;

INSERT INTO public.page_permissions (page_key, allowed_roles) VALUES
    ('queue',       ARRAY['admin','dispatcher','responder']),
    ('new',         ARRAY['admin','dispatcher','responder','resident']),
    ('residents',   ARRAY['admin']),
    ('departments', ARRAY['admin']),
    ('settings',    ARRAY['admin'])
ON CONFLICT (page_key) DO NOTHING;

DROP POLICY IF EXISTS "page_permissions_read" ON public.page_permissions;
CREATE POLICY "page_permissions_read"
    ON public.page_permissions
    FOR SELECT
    TO authenticated
    USING (true);

DROP POLICY IF EXISTS "page_permissions_admin_update" ON public.page_permissions;
CREATE POLICY "page_permissions_admin_update"
    ON public.page_permissions
    FOR UPDATE
    TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "page_permissions_admin_insert" ON public.page_permissions;
CREATE POLICY "page_permissions_admin_insert"
    ON public.page_permissions
    FOR INSERT
    TO authenticated
    WITH CHECK (public.is_admin());

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime'
          AND schemaname = 'public'
          AND tablename = 'page_permissions'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.page_permissions;
    END IF;
END $$;
