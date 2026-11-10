-- Required suspension remark.
-- When an admin suspends an account they must say why — the reason is
-- shown to the user on the suspended screen and included in the
-- suspension email. Reactivation clears it.
alter table public.user_profiles
  add column if not exists suspension_reason text;
