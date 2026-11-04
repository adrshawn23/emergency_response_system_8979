-- Cross-department assistance requests.
-- Dispatch/admin requests help on an incident from other departments; members
-- of the requested department see the request in their responder view and can
-- accept or decline it.

CREATE TABLE IF NOT EXISTS public.cross_department_assistance (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    report_id               UUID NOT NULL REFERENCES public.emergency_reports(id) ON DELETE CASCADE,
    assisting_department_id UUID NOT NULL REFERENCES public.departments(id) ON DELETE CASCADE,
    requested_by            UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    responded_by            UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    status                  TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'accepted', 'declined', 'cancelled')),
    notes                   TEXT,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (report_id, assisting_department_id)
);

CREATE INDEX IF NOT EXISTS idx_cda_dept_status
    ON public.cross_department_assistance (assisting_department_id, status);
CREATE INDEX IF NOT EXISTS idx_cda_report
    ON public.cross_department_assistance (report_id);

ALTER TABLE public.cross_department_assistance ENABLE ROW LEVEL SECURITY;

-- Staff (admin/dispatcher) can see and manage every request.
CREATE POLICY cda_staff_select ON public.cross_department_assistance
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles up
            WHERE up.id = auth.uid()
              AND up.role IN ('admin', 'dispatcher')
        )
        OR EXISTS (
            -- Department members see requests targeted at their own dept.
            SELECT 1 FROM public.user_profiles up
            WHERE up.id = auth.uid()
              AND up.role = 'responder'
              AND up.department_id = cross_department_assistance.assisting_department_id
        )
    );

CREATE POLICY cda_staff_insert ON public.cross_department_assistance
    FOR INSERT TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.user_profiles up
            WHERE up.id = auth.uid()
              AND up.role IN ('admin', 'dispatcher')
        )
    );

-- Staff may update any row; members of the targeted department may
-- accept/decline (mark status, set responded_by).
CREATE POLICY cda_staff_update ON public.cross_department_assistance
    FOR UPDATE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles up
            WHERE up.id = auth.uid()
              AND up.role IN ('admin', 'dispatcher')
        )
        OR EXISTS (
            SELECT 1 FROM public.user_profiles up
            WHERE up.id = auth.uid()
              AND up.role = 'responder'
              AND up.department_id = cross_department_assistance.assisting_department_id
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.user_profiles up
            WHERE up.id = auth.uid()
              AND up.role IN ('admin', 'dispatcher')
        )
        OR EXISTS (
            SELECT 1 FROM public.user_profiles up
            WHERE up.id = auth.uid()
              AND up.role = 'responder'
              AND up.department_id = cross_department_assistance.assisting_department_id
        )
    );
