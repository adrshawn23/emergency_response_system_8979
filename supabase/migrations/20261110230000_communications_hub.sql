-- Communications hub (specs/004-emergency-communications):
--   department_contacts — admin-managed hotline/contact directory.
--   announcements       — admin broadcast advisories (+ optional incident link).
-- Apply via Supabase SQL editor.

BEGIN;

-- ----------------------------------------------------------------------
-- department_contacts — dynamic directory, sorted, soft-deletable.
-- department_id NULL = general hotline (barangay hall, national 911, …).
-- ----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.department_contacts (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    department_id UUID REFERENCES public.departments(id) ON DELETE SET NULL,
    label         TEXT NOT NULL,
    channel       TEXT NOT NULL DEFAULT 'phone'
                  CHECK (channel IN ('phone','radio','email','other')),
    value         TEXT NOT NULL,
    description   TEXT,
    sort_order    INT NOT NULL DEFAULT 0,
    active        BOOLEAN NOT NULL DEFAULT true,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.department_contacts ENABLE ROW LEVEL SECURITY;

-- Everyone signed in reads active entries; admins also see inactive rows
-- (they get a separate all-rows read).
CREATE POLICY contacts_public_select ON public.department_contacts
    FOR SELECT TO authenticated
    USING (active = true);

CREATE POLICY contacts_admin_select ON public.department_contacts
    FOR SELECT TO authenticated
    USING (EXISTS (SELECT 1 FROM public.user_profiles up
                   WHERE up.id = auth.uid() AND up.role = 'admin'));

CREATE POLICY contacts_admin_insert ON public.department_contacts
    FOR INSERT TO authenticated
    WITH CHECK (EXISTS (SELECT 1 FROM public.user_profiles up
                        WHERE up.id = auth.uid() AND up.role = 'admin'));

CREATE POLICY contacts_admin_update ON public.department_contacts
    FOR UPDATE TO authenticated
    USING (EXISTS (SELECT 1 FROM public.user_profiles up
                   WHERE up.id = auth.uid() AND up.role = 'admin'))
    WITH CHECK (EXISTS (SELECT 1 FROM public.user_profiles up
                        WHERE up.id = auth.uid() AND up.role = 'admin'));

CREATE POLICY contacts_admin_delete ON public.department_contacts
    FOR DELETE TO authenticated
    USING (EXISTS (SELECT 1 FROM public.user_profiles up
                   WHERE up.id = auth.uid() AND up.role = 'admin'));

-- ----------------------------------------------------------------------
-- announcements — broadcast advisories; optional incident link feeds the
-- linked incident's map/progress into the email + page.
-- ----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.announcements (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title       TEXT NOT NULL,
    body        TEXT NOT NULL,
    severity    TEXT NOT NULL DEFAULT 'info'
                CHECK (severity IN ('info','warning','critical')),
    report_id   UUID REFERENCES public.emergency_reports(id) ON DELETE SET NULL,
    created_by  UUID NOT NULL REFERENCES public.user_profiles(id),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;

CREATE POLICY announcements_read ON public.announcements
    FOR SELECT TO authenticated
    USING (true);

CREATE POLICY announcements_admin_insert ON public.announcements
    FOR INSERT TO authenticated
    WITH CHECK (EXISTS (SELECT 1 FROM public.user_profiles up
                        WHERE up.id = auth.uid() AND up.role = 'admin'));

CREATE POLICY announcements_admin_update ON public.announcements
    FOR UPDATE TO authenticated
    USING (EXISTS (SELECT 1 FROM public.user_profiles up
                   WHERE up.id = auth.uid() AND up.role = 'admin'))
    WITH CHECK (EXISTS (SELECT 1 FROM public.user_profiles up
                        WHERE up.id = auth.uid() AND up.role = 'admin'));

CREATE POLICY announcements_admin_delete ON public.announcements
    FOR DELETE TO authenticated
    USING (EXISTS (SELECT 1 FROM public.user_profiles up
                   WHERE up.id = auth.uid() AND up.role = 'admin'));

-- Realtime: the announcements page + directory update live (FR-006).
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables
                   WHERE pubname = 'supabase_realtime'
                     AND schemaname = 'public' AND tablename = 'announcements') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.announcements;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables
                   WHERE pubname = 'supabase_realtime'
                     AND schemaname = 'public' AND tablename = 'department_contacts') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.department_contacts;
    END IF;
END $$;

COMMIT;
