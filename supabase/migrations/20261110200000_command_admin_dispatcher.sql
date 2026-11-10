-- Command center is admin + dispatcher only.
-- Residents land on ResidentHome and responders on their response board;
-- department admins now go straight to the incident queue. The live
-- page_permissions row overrides the code default, so this update is
-- required for the gate to take effect.
update public.page_permissions
set allowed_roles = array['admin', 'dispatcher']
where page_key = 'command';
