# Phase 1 Data Model: New Registrant Filtration

**Date**: 2026-11-10 | **Feature**: `003-registrant-filtration`

All storage already exists — this feature introduces **no new tables or columns** (verified against `supabase/migrations/20261030101000_verification_enforcement.sql` and live schema probes from prior sessions). The model below documents how existing entities serve the feature.

## Entities

### `user_profiles` (existing — registrant)

| Field | Role in feature |
|-------|-----------------|
| `id`, `full_name`, `email`, `phone`, `address`, `birthdate`, `residency_type` | Registrant detail shown in list + modal |
| `role` | `resident`/`responder`/`dispatcher`/`department_admin` — all route through the same queue (FR-010) |
| `status`, `account_status` | `pending`/`inactive` = unreviewed registrant; `active` = approved; gates sign-in + reporting |
| `approved_at`, `approved_by` | Audit context on Approved view |

### `id_verifications` (existing — review state + evidence)

| Field | Role in feature |
|-------|-----------------|
| `verification_status` | **The four views**: `pending`/`under_review` → For Approval; `needs_clarity`/`correction_required` → Returned; `approved` → Approved; `rejected` → Rejected; `superseded` → prior revision, hidden from views |
| `submission_revision` | `> 1` ⇒ Resubmitted badge (FR-012) |
| `decision_reason` / `review_notes` | Clarification note — shown to registrant (banner + notification) and to reviewer on resubmission |
| `decision_at`, `reviewed_by` | Decision context on terminal views |
| `id_document_url` / `document_storage_path` | ID evidence rendered in modal |
| `ocr_data`, `ocr_confidence` | OCR chips already shown in modal |

### `notifications` (existing — Q1-C leg)

| Field | Role in feature |
|-------|-----------------|
| `user_id` | Recipient = returned registrant |
| `type` = `'verification_decision'` | New notification type string (no enum constraint on type — verify at task time) |
| `title` / `body` | Carries the clarification note text |
| `link` | `/resident-home` deep-link to the verification card |

## State transitions

```text
signup ──► (pending verification row OR none) ──► FOR APPROVAL
                                                        │
              admin modal decision ──┬── approved ───────► APPROVED (terminal, account active)
                                     ├── rejected ───────► REJECTED (terminal, archived view)
                                     └── needs_clarity ──► RETURNED (banner + notification)
                                                              │
                          registrant re-uploads ID ───────────┘
                          (new row: revision+1, old → superseded,
                           status forced back to 'pending' by
                           guard_verification_insert)
                              ──► FOR APPROVAL + "Resubmitted" badge
```

## Validation rules (from requirements)

- Exactly one view per registrant at all times — enforced because each registrant's latest non-superseded row has exactly one status, and superseded rows are excluded from views.
- Terminal immutability (FR-007): `guard_verification_update` + `review_verification` admin-guard mean only `review_verification` may transition; the UI simply never offers actions on approved/rejected rows.
- Non-approved decisions require a non-empty reason — already enforced inside `review_verification` (`p_reason` check).
- Client may never write decision/OCR fields — `guard_verification_insert` strips them server-side.
