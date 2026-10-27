#!/bin/bash
# test_driver.sh
# Driver to run migration tests in a disposable database context.

set -e

DB_NAME="test_migration_db_$(date +%s)"
createdb "$DB_NAME"

# Function to run a SQL file
run_sql() {
    psql -d "$DB_NAME" -v ON_ERROR_STOP=1 -f "$1"
}

# Cleanup on exit
trap 'dropdb "$DB_NAME"' EXIT

echo "--- 1. Testing Invalid Data Rejection ---"
# Setup for failure case
psql -d "$DB_NAME" -c "CREATE TABLE public.emergency_reports (attachments JSONB); INSERT INTO public.emergency_reports VALUES ('{\"status\": \"invalid\"}');"
# This is expected to fail
if run_sql "supabase/migrations/20261021210000_fix_emergency_reports_schema_v9.sql"; then
    echo "FAILED: Migration should have failed on invalid data."
    exit 1
else
    echo "PASSED: Migration correctly rejected invalid data."
fi

echo "--- 2. Testing Migration, Backfill, and Idempotency ---"
psql -d "$DB_NAME" -c "TRUNCATE public.emergency_reports; INSERT INTO public.emergency_reports (attachments) VALUES ('{\"status\": \"assigned\", \"priority\": \"high\"}'), ('{\"status\": \"pending\"}');"

run_sql "supabase/migrations/20261021210000_fix_emergency_reports_schema_v9.sql"
run_sql "supabase/migrations/20261021210000_fix_emergency_reports_schema_v9.sql" # Rerun

echo "--- 3. Asserting Results ---"
psql -d "$DB_NAME" -t -c "SELECT count(*) FROM public.emergency_reports WHERE report_id LIKE 'RPT-%';" | grep -q 2
psql -d "$DB_NAME" -t -c "SELECT count(*) FROM public.emergency_reports WHERE status = 'assigned';" | grep -q 1
echo "PASSED: All assertions passed."
