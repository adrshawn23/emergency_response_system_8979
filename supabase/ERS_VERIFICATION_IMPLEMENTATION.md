# ERS Verification, Notifications & Profiles — Implementation Notes

Branch: `feature/ers-verification-notifications-profiles`
Status: local branch only — **nothing applied to production**.

## What changed and why

### 1. Verification trust model (was: browser-controlled, now: server-controlled)

Before: registration ran Tesseract OCR **in the browser**, passed `id_document_url`
(a raw base64 data URL), `ocr_data`, `ocr_confidence`, and `name_match`/`dob_match`
flags through `supabase.auth.signUp` metadata. The dashboard then **auto-approved**
any row at `ocr_confidence >= 80` whose client-written match flags were true —
meaning a crafted signup request could approve itself, and raw ID images sat in
auth metadata forever.

Now:

- Signup metadata carries **only declared profile fields** (name, phone, dob,
  address, contacts, role). No image bytes, no OCR results.
- `supabase/functions/verify-id` is the only OCR path: JWT-verified, rate-limited
  (5 submissions/hour/user), validates the image by magic bytes, writes it to the
  private `id-documents` bucket at a random path, runs server-side OCR
  (Google Vision `DOCUMENT_TEXT_DETECTION` when configured), extracts fields
  from raw text — never copying declared values — and returns only
  `pending_admin` or `correction_required`.
- `src/utils/verificationRules.js` (client hints) and
  `supabase/functions/_shared/verificationRules.ts` (authoritative) implement
  identical conservative comparisons: name matching tolerates order, initials,
  suffixes and single OCR spelling errors; dates handle ISO/named-month/ambiguous
  numeric formats; jurisdiction resolves Kalubihan, Cebu City vs known outside
  barangays/cities. **No code path returns an approval outcome.**
- `review_verification(p_id, p_decision, p_reason)` SECURITY DEFINER RPC is the
  only approval path: admin check, row lock, stale-submission rejection,
  atomic verification update + profile activation + audit row. The dashboard
  calls it with a graceful fallback to the legacy direct updates when the
  function isn't deployed yet.
- Rejection **no longer deletes the applicant** (the old `user_profiles.delete()`
  silently no-oped under RLS anyway). The account stays pending; the resident
  sees the reason and a resubmit control.
- `guard_verification_insert` strips decision/OCR fields from any client-inserted
  row; `guard_verification_update` blocks non-admin updates entirely;
  `guard_profile_self_update` prevents self edits of role/status/department and
  invalidates prior approval on identity changes; new submissions supersede
  older open ones.
- Pending residents cannot insert `emergency_reports`
  (`caller_can_report()` replaces all prior INSERT policies), enforced server-side.
- ID documents live only in the private `id-documents` bucket (own-folder write,
  admin read, 5 MB, JPEG/PNG/WebP); reviewers get 5-minute signed URLs.
  `purge_reviewed_id_documents()` implements 7-day post-review / 30-day
  unreviewed retention and `purge_orphan_id_documents()` cleans strays —
  scheduled via pg_cron when available, else document the manual schedule.

### 2. Persistent notifications (was: fabricated in-memory objects)

Before: every bell fabricated notification objects inside the client realtime
handler — nothing persisted, nothing reached the bell on other devices, the
dropdown had no read state and no View All.

Now: `notifications` gains `type/title/message/metadata`, a private
`create_notification()` helper, and triggers that notify dispatchers+admins on
new incidents, the reporter + assignee on status changes, the responder on
assignment, the applicant on verification decisions, and admins on new
registrations. Reads stay scoped to the recipient (`recipient_id = auth.uid()`);
mutations go through `mark_notifications_read` / `mark_all_notifications_read`
RPCs — no direct UPDATE policy exists, so a client can never forge read state
on someone else's rows. `useNotifications` backs a shared
`NotificationBell` (unread badge, keyboard/outside-click handling, per-item +
mark-all, incident deep-link) mounted in the dashboard command center, the
workspace header, the responder board, and the resident portal — plus a
`/notifications` page for View All.

### 3. Shared profile & account settings (was: per-shell ad-hoc blocks)

`SidebarProfile` replaces every hardcoded profile card ("Administrator",
"Active Account", fake "Online"): real avatar or initial, real name, real role,
real `account_status`, and a menu with My Profile / Account Settings / Logout.
It's used in both dashboard asides, the responder header, and the resident
header. The profile section is now editable for every role (first/last name,
phone, avatar via the public `avatars` bucket), and `/settings` is open to all
roles with persisted `notification_prefs` toggles — mandatory security/
verification notices are locked on — while service-boundary and provider
configuration stay admin-only.

### 4. Resident registration/status experience

`resident-home` gained a verification card that reads the latest
`id_verifications` row and renders the right state — under review, correction
needed, clearer photo needed, or rejected — including the reviewer reason and
an in-place resubmit uploader (same server-verification path). The report CTA
is disabled until `account_status = 'active'`, matching the server-side gate.

## Database work (apply in order, via Supabase SQL editor)

1. `supabase/migrations/20261030100000_notifications_reconcile.sql`
2. `supabase/migrations/20261030101000_verification_enforcement.sql`
3. `supabase/migrations/20261030102000_profile_preferences.sql`
4. `supabase/migrations/20261030103000_id_document_storage.sql`

Then deploy the function:

```powershell
supabase functions deploy verify-id
supabase secrets set GOOGLE_VISION_API_KEY=<key>   # optional; function degrades to manual review without it
```

## Required configuration

- **Supabase** — `id-documents` and `avatars` storage buckets come from
  migration 4; the `supabase_realtime` publication must include
  `notifications` (the migration adds it when the publication exists).
- **Google Cloud Vision** — `GOOGLE_VISION_API_KEY` secret for OCR; without it
  `verify-id` returns `ocr_unavailable` and every submission stays manual-review.
- **Email confirmation** — when enabled, signup returns no session, so the ID
  upload happens at first login instead; `submitIdForVerification` covers that.
- **pg_cron** (optional) — enables the nightly retention purge; otherwise call
  the two purge functions manually or via any scheduler.

## Rollback

- Migrations: each file is idempotent and only adds columns/policies — to roll
  back, `DROP TRIGGER`/`DROP POLICY`/`DROP FUNCTION` the listed objects and,
  if truly needed, `ALTER TABLE ... DROP COLUMN` the added columns. Dropping
  the `review_verification` RPC reverts approvals to the legacy client path
  (already handled by the code's fallback).
- Client: `git revert` this branch — the dashboard tolerates a missing RPC,
  missing `notification_prefs` column, and a missing `id-documents` bucket.
- Storage: `DELETE FROM storage.objects WHERE bucket_id IN ('id-documents','avatars')`
  then drop the buckets and their policies.

## Known blockers / TODO

- **PSGC** — confirmed: `JURISDICTION.psgc_barangay_code = '0730600033'`
  (Kalubihan (Pob.), Cebu City; legacy code 072217033). The outside-jurisdiction
  list remains hand-maintained and non-exhaustive — unknown places stay pending
  for human review rather than being rejected.
- **Geofence polygon** — the migration seed and
  `supabase/set_kalubihan_boundary.sql` carry a polygon traced from the public
  Google/OSM outline; replace with the official GIS boundary file when the
  barangay provides it. Run `set_kalubihan_boundary.sql` in the SQL editor to
  update the live table (the seed only fires when no active boundary exists).
- **OCR provider** — `verify-id` ships with a Google Vision adapter; swap the
  `runOcr` function for Textract/Azure if a different provider is chosen.
- **Live schema drift** — `user_profiles.approved_at`/`approved_by` and the
  notification preferences column only exist after migration; the UI degrades
  gracefully (fallback approve path, localStorage prefs) until they do.
- **Retention policy** — 7-day/30-day windows are proposed defaults, not
  barangay-confirmed numbers; document the final choice when set.
- **Legacy `ocrIdDocument`** — still exported from `src/utils/ocr.js` for the
  remaining `fileToDataUrl` helper; the OCR call itself is now unused and can
  be removed in a cleanup pass.

## Verification

- `npx playwright test e2e/verification_rules.spec.js` — **28/28 green**
- `npx vite build` — clean, 2609 modules
- RLS/edge-function behavior not exercised against a live project in this
  environment; stage the migrations and function before merging.

## PR text

> ### ERS verification, notifications & profiles
>
> - **Server-controlled verification**: verify-id edge function (JWT auth,
>   rate-limited, magic-byte validation, private storage, Google Vision OCR)
>   plus `review_verification()` — the single atomic approval path. Browser OCR
>   and auth-metadata document transfer removed.
> - **Conservative comparison rules**: name/date/jurisdiction matching shared
>   between client hints and the edge function; outcomes are only
>   `pending_admin` or `correction_required` — matches never auto-approve.
> - **Enforcement**: RLS/trigger guards prevent clients writing decisions or
>   OCR, block self role/status edits, supersede old submissions, invalidate
>   approval on identity changes, and stop pending residents filing reports.
> - **Private document storage** with signed URLs and retention purge
>   functions; nothing sensitive lands in auth metadata or logs.
> - **Real notifications**: schema + triggers + RPCs, shared NotificationBell
>   with unread badge/read state/incident deep-links, and a `/notifications`
>   page across resident, responder, dispatcher and admin.
> - **Consistent account surface**: shared SidebarProfile (real name/role/
>   status, My Profile/Account Settings/Logout), editable profile with avatar
>   upload, `/settings` for all roles with persisted notification prefs, and
>   a resident verification-status/resubmit card.
>
> Testing: 28/28 verification-rules spec green; `vite build` clean.
> Follow-ups: apply the four migrations, deploy verify-id, set the Vision key.
