-- Reassignment requests: department admins flag a wrongly-assigned
-- incident for the dispatcher to re-dispatch. Dept admins cannot reassign
-- the main department themselves — dispatch stays a dispatcher job; they
-- file a request with a required reason that the dispatcher reviews.
--
-- Apply in the Supabase SQL editor.

create table if not exists public.reassignment_requests (
  id             uuid primary key default gen_random_uuid(),
  report_id      uuid not null references public.emergency_reports(id) on delete cascade,
  department_id  uuid not null references public.departments(id),
  requested_by   uuid not null references public.user_profiles(id),
  reason         text not null check (length(trim(reason)) > 0),
  status         text not null default 'pending'
                 check (status in ('pending', 'approved', 'denied', 'cancelled')),
  reviewed_by    uuid references public.user_profiles(id),
  reviewed_at    timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- One live request per report — a second request can't pile up while the
-- first is still pending (dup clicks, page reloads).
create unique index if not exists reassignment_one_pending_per_report
  on public.reassignment_requests (report_id)
  where status = 'pending';

create index if not exists idx_reassignment_requests_status
  on public.reassignment_requests (status, created_at desc);

alter table public.reassignment_requests enable row level security;

-- Dept admin files a request for a report assigned to THEIR department.
drop policy if exists rr_dept_admin_insert on public.reassignment_requests;
create policy rr_dept_admin_insert on public.reassignment_requests
  for insert to authenticated
  with check (
    requested_by = auth.uid()
    and department_id = (select department_id::uuid from public.user_profiles
                         where id = auth.uid())
    and (select role::text from public.user_profiles where id = auth.uid())
        = 'department_admin'
    -- Outer refs must be table-qualified: inside the EXISTS, bare
    -- `report_id` binds to r.report_id (text) not the row being checked.
    and exists (
      select 1 from public.emergency_reports r
      where r.id = reassignment_requests.report_id
        and r.assigned_department_id::uuid = reassignment_requests.department_id
        and r.status <> 'resolved'
    )
  );

-- Staff read access: dispatcher/admin see everything, dept admin sees
-- requests filed against their own department.
drop policy if exists rr_staff_select on public.reassignment_requests;
create policy rr_staff_select on public.reassignment_requests
  for select to authenticated
  using (
    (select role::text from public.user_profiles where id = auth.uid())
      in ('dispatcher', 'admin')
    or department_id = (select department_id::uuid from public.user_profiles
                        where id = auth.uid())
  );

-- Dispatcher/admin review (approve/deny). Dept admin may retract their
-- own still-pending request (cancel).
drop policy if exists rr_staff_update on public.reassignment_requests;
create policy rr_staff_update on public.reassignment_requests
  for update to authenticated
  using (
    (select role::text from public.user_profiles where id = auth.uid())
      in ('dispatcher', 'admin')
    or (
      requested_by = auth.uid()
      and status = 'pending'
    )
  )
  with check (true);
