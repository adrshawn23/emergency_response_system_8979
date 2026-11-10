# Live Probe Notes — T001/T002 (2026-11-10)

Admin sign-in via publishable key; all reads under RLS.

## T001 — schema + data

- `id_verifications` — all required columns live: `id, user_id, verification_status, submission_revision, decision_reason, document_storage_path, review_notes, decision_at`. At least one `submission_revision > 1` row exists (resubmission path exercised).
- `notifications` — real columns differ from the contract draft: `recipient_id` (NOT `user_id`), `message` (NOT `body`), `action_url` + `metadata` (for deep-link), plus `title, type, priority, read, channel, delivery_status, sent_at, read_at, retry_count, failure_reason, incident_id, assistance_request_id`. `useNotifications` selects `id,type,title,message,incident_id,metadata,read_at,created_at` filtered `recipient_id=eq.<uid>` — the bell surfaces any `type` with no enum filtering observed; no `type` CHECK constraint found in migrations.
- `review_verification` — invoked from `dashboard/index.jsx` (rpc call + fallback); prior session verified it live via `pg_proc`.
- Roles with verification rows today: `admin`, `resident` only — staff registrants (responder/dispatcher/department_admin) have none yet; FR-010 is satisfied structurally (buckets derive from ALL verification rows regardless of role).
- `supabase_realtime` publication membership — cannot be probed via anon key; migrations show `notifications`, `user_profiles`, `page_permissions`, `incident_messages`, `responder_locations`, `incident_status_history` added — `id_verifications` never appears in any publication statement → assume ABSENT; T003 adds it defensively (`pg_publication_tables` guard).

## T002 — residents page gate

- Live `page_permissions.residents` = `['admin']`.
- `DEFAULT_PAGE_ROLES.residents` = `['admin']` in `src/contexts/AuthContext.jsx`.
- Match — admin-only, no change needed.
