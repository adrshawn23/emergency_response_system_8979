-- Duplicate-incident check for the report composer.
--
-- When a resident submits a report we look for an already-open report of the
-- SAME TYPE within a short radius of the same coordinates. The composer then
-- warns the second reporter "this incident may already be reported" instead
-- of silently creating a duplicate — no dispatcher triage needed.
--
-- security definer + minimal columns: residents cannot read other users'
-- reports under RLS, and we do not want this lookup to leak report contents.
-- Returns only type/location/distance/time for UI warning purposes.
--
-- An incident is "open" until resolved/cancelled/duplicate, so the window is
-- the report's lifetime — not a fixed number of minutes. A 12h recency cap
-- keeps stale, never-closed rows from warning forever.

-- Return type changed vs the first version (status column added) —
-- CREATE OR REPLACE cannot alter a function's return shape.
drop function if exists public.check_duplicate_incidents(double precision, double precision, text);

create function public.check_duplicate_incidents(
  p_lat double precision,
  p_lng double precision,
  p_report_type text
)
returns table (
  id uuid,
  report_type text,
  status text,
  location text,
  created_at timestamptz,
  distance_m double precision
)
language sql
security definer
set search_path = public
as $$
  select * from (
    select
      r.id,
      r.report_type::text,
      r.status::text,
      coalesce(r.attachments->>'location', '') as location,
      r.created_at,
      (
        6371000 * acos(
          least(1.0, greatest(-1.0,
            cos(radians(p_lat))
            * cos(radians((r.attachments->>'latitude')::double precision))
            * cos(
                radians((r.attachments->>'longitude')::double precision)
                - radians(p_lng)
              )
            + sin(radians(p_lat))
            * sin(radians((r.attachments->>'latitude')::double precision))
          ))
        )
      ) as distance_m
    from public.emergency_reports r
    where r.status in ('pending', 'assigned', 'in-progress')
      and r.report_type::text = p_report_type
      and r.created_at > now() - interval '12 hours'
      and r.attachments->>'latitude' is not null
      and r.attachments->>'longitude' is not null
  ) t
  where t.distance_m <= 150
  order by t.distance_m asc
  limit 3;
$$;

revoke all on function public.check_duplicate_incidents(double precision, double precision, text) from public;
grant execute on function public.check_duplicate_incidents(double precision, double precision, text) to authenticated;
