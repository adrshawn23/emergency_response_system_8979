-- Same-department backup requests (responder -> dept admin).
--
-- A responder on scene who lacks resources requests a second responder from
-- THEIR OWN department. Unlike cross_department_assistance (dept-to-dept),
-- this is intra-dept, responder-initiated, and dept-admin-gated:
--   - requester must be the report's assigned (or backup) responder
--   - a reason (remark) is required
--   - only the department admin approves (picking the backup responder)
--     or declines — a decline MUST carry review_notes so the responder
--     sees why
-- On approval the report's backup_responder_id is set so the backup
-- responder sees the incident on their board.

alter table public.emergency_reports
  add column if not exists backup_responder_id uuid
  references public.user_profiles(id) on delete set null;

create index if not exists idx_emergency_reports_backup_responder
  on public.emergency_reports(backup_responder_id);

create table if not exists public.responder_backup_requests (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.emergency_reports(id) on delete cascade,
  department_id uuid not null references public.departments(id) on delete cascade,
  requested_by uuid not null references public.user_profiles(id) on delete cascade,
  backup_responder_id uuid references public.user_profiles(id) on delete set null,
  reason text not null check (length(btrim(reason)) > 0),
  review_notes text,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'declined', 'cancelled')),
  reviewed_by uuid references public.user_profiles(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- A decline is meaningless without the why — enforced at the row level.
  constraint backup_review_notes_required
    check (status <> 'declined' or length(btrim(coalesce(review_notes, ''))) > 0)
);

-- One pending request per incident — a second click can't queue dupes.
create unique index if not exists backup_one_pending_per_report
  on public.responder_backup_requests(report_id)
  where status = 'pending';

alter table public.responder_backup_requests enable row level security;

-- Request: responder on the incident (primary or existing backup), own dept,
-- report still open.
drop policy if exists backup_responder_insert on public.responder_backup_requests;
create policy backup_responder_insert on public.responder_backup_requests
  for insert to authenticated
  with check (
    requested_by = auth.uid()
    and (select role::text from public.user_profiles where id = auth.uid())
      = 'responder'
    and department_id = (select department_id::uuid from public.user_profiles
                         where id = auth.uid())
    and exists (
      select 1 from public.emergency_reports r
      where r.id = responder_backup_requests.report_id
        and (r.assigned_to = auth.uid() or r.backup_responder_id = auth.uid())
        and r.assigned_department_id::uuid = responder_backup_requests.department_id
        and r.status in ('assigned', 'in-progress')
    )
  );

-- Read: dispatcher/admin everything; dept admin their dept; requester own;
-- the chosen backup sees requests naming them.
drop policy if exists backup_staff_select on public.responder_backup_requests;
create policy backup_staff_select on public.responder_backup_requests
  for select to authenticated
  using (
    (select role::text from public.user_profiles where id = auth.uid())
      in ('dispatcher', 'admin')
    or department_id = (select department_id::uuid from public.user_profiles
                        where id = auth.uid())
    or requested_by = auth.uid()
    or backup_responder_id = auth.uid()
  );

-- Review: dispatcher/admin + the dept's admin (approve/decline); requester
-- may withdraw their own still-pending request.
drop policy if exists backup_staff_update on public.responder_backup_requests;
create policy backup_staff_update on public.responder_backup_requests
  for update to authenticated
  using (
    (select role::text from public.user_profiles where id = auth.uid())
      in ('dispatcher', 'admin')
    or (
      (select role::text from public.user_profiles where id = auth.uid())
        = 'department_admin'
      and department_id = (select department_id::uuid from public.user_profiles
                           where id = auth.uid())
    )
    or (
      requested_by = auth.uid()
      and status = 'pending'
    )
  )
  with check (true);

-- Realtime: dept-admin banner + responder board subscribe to this table.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime')
     AND NOT EXISTS (
       SELECT 1 FROM pg_publication_tables
       WHERE pubname = 'supabase_realtime' AND schemaname = 'public'
         AND tablename = 'responder_backup_requests'
     ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.responder_backup_requests;
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Could not add responder_backup_requests to realtime publication: %', SQLERRM;
END;
$$;

-- Slim list view: surface backup_responder_id so the responder board can
-- filter on it. Postgres requires existing columns keep name+order —
-- the new column goes last.
create or replace view public.emergency_reports_list
with (security_invoker = on) as
select
    id,
    incident_id,
    reporter_id,
    report_type,
    content,
    created_at,
    updated_at,
    assigned_to,
    assigned_department_id,
    report_id,
    status,
    priority,
    resolved_at,
    (
        select coalesce(jsonb_object_agg(e.k, e.v), '{}'::jsonb)
        from jsonb_each(coalesce(attachments, '{}'::jsonb)) as e(k, v)
        where octet_length(e.v::text) < 8192
    ) as attachments,
    backup_responder_id
from public.emergency_reports;
