-- department_admin — part 1 of 2: enum value.
-- The Supabase SQL editor executes a whole script inside ONE transaction,
-- so ALTER TYPE ... ADD VALUE cannot share a script with statements that
-- reference the new value (error 55P04). RUN THIS FILE ALONE FIRST,
-- then run 20261109060000_department_admin_role.sql.

ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'department_admin';
