# Kalubihan Emergency Response System Constitution

## Core Principles

### I. RLS Is the Security Boundary
Row Level Security in Supabase is the enforcement layer — client checks are
UX affordances only and are bypassable via direct API calls. Any feature
that restricts behavior (roles, ownership, pending state) MUST be enforced
by a policy, RPC, or Edge Function, never only in React. Client-side
validation duplicates the rule for UX but is never the sole guard.

### II. Roles & Lifecycle Are Canonical
- `user_profiles.role`: `resident | dispatcher | responder | department_admin | admin`
  (`department_admin` manages a single department's queue/responders — added
  2026-11-10 after verified use across page_permissions, SECTION_ROLES, and
  the dept-admin write guards).
- `user_profiles.status = 'inactive'` means awaiting admin approval — that
  IS the pending-registration signal (drive badges/counters from it).
- `account_status = 'suspended'` blocks at ProtectedRoute.
- Approval/rejection goes through `review_verification()` RPC (migration
  20261030101000 — atomic decision+activation+audit). Direct table updates
  are the documented fallback only.
- `page_permissions` matrix + `canAccessPage()` gates both routes
  (RoleRoute) and render (Dashboard early-return). Both layers stay.

### III. Live Schema Beats Migration Files
Not every file in `supabase/migrations/` is applied to the live DB. Probe
the live schema before writing queries — verified gaps include
`emergency_reports_list` (slim view, security_invoker), `phone` (not
`phone_number`), no `is_active`/`approved_at`/`approved_by` on
`user_profiles`. Migrations are applied manually via the Supabase SQL
editor — never assume `supabase db push` ran.

### IV. Large Payloads Stay Out of Lists
`emergency_reports.attachments` carries base64 media (was ~7.5MB). List
queries MUST use `emergency_reports_list`; full rows are lazily fetched on
detail/assignment open. Never `SELECT *` from `emergency_reports` in a list
context.

### V. Realtime Discipline
- Channel names must be unique per subscriber instance (e.g. `useId()`
  suffix) — duplicate names throw "cannot add callbacks after subscribe()".
- Always `removeChannel` in effect cleanup.
- Postgres changes need the table in the `supabase_realtime` publication.
- Remount-fragile state that drives persistent UI (badges) uses
  module-level caching to avoid empty-flash.

### VI. Change Discipline
Minimal upstream fixes over downstream workarounds. No unrelated edits. No
pushes/deploys/migrations without explicit user approval — local
commits/branches are reviewable by default. The dashboard file
(`src/pages/dashboard/index.jsx`) has a recurring stray-tail-corruption
pattern; verify the file tail parses after every edit there.

### VII. Test-Verified Claims Only
Every feature/fix affecting a user flow gets or updates a Playwright e2e
test under `e2e/` (`npm test`). Never claim tests pass without running
them. `npm run build` is the minimum bar before a push.

## Data & Security Constraints

- Residents MUST attach at least 1 photo per incident report (staff
  optional — phone-reported incidents). Client-side exists; DB-level
  enforcement is a known open gap.
- RLS DELETE limitation: the publishable key silently cannot delete
  `user_profiles`/`id_verifications` (0 rows, no error). Test-data cleanup
  requires SQL editor (`supabase/cleanup_test_data.sql`).
- ID documents live in private Storage — always signed URLs; legacy `data:`
  URLs render directly. Never print secrets; env via `.env` only.
- Edge Functions: `verify-id` (OCR via tesseract.js -> auto-approve >=90%
  match), `notify-decision` (Resend; `EMAIL_FROM` falls back to
  `onboarding@resend.dev`).

## Workflow

Feature work follows `/speckit.*` commands in `.windsurf/workflows/`:
specify -> clarify -> plan -> checklist -> tasks -> analyze -> implement ->
converge. Specs live in `specs/<NNN-slug>/`. Bug work uses the bug
extension flow (assess -> fix -> test, verified verdict) or the existing
`/latent-issue-audit` workflow. A spec defines the CHANGE, not retroactive
docs of existing behavior.

## Governance

This constitution supersedes ad-hoc memory/summary carryovers. Amendments
need an explicit user-requested rule change or a verified codebase change —
document the reason and bump the version. All plans/tasks/checklists are
evaluated against these principles; violations are called out in analyze.

**Version**: 1.0.0 | **Ratified**: 2026-11-08 | **Last Amended**: 2026-11-08
