-- Migration: 20261022150000_restore_resolved_at_column.sql
-- FIX: The update_emergency_reports_timestamp trigger sets NEW.resolved_at when
-- a report transitions to 'resolved', but the resolved_at column is missing in
-- the live emergency_reports table. Every UPDATE to status='resolved' fails
-- with Postgres error 42703: record "new" has no field "resolved_at".
-- This restores the column defined in the original schema
-- (20250105014120_emergency_response_system.sql, line 83).
BEGIN;

ALTER TABLE public.emergency_reports
    ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ;

COMMIT;
