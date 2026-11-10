# Implementation Plan: New Registrant Filtration

**Branch**: `003-registrant-filtration` | **Date**: 2026-11-10 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/003-registrant-filtration/spec.md`

## Summary

Four status views (For Approval / Returned / Approved / Rejected) with counts on the existing Residents & review admin surface, decisions inside the existing review modal. The lifecycle is already server-enforced: `review_verification()` owns transitions atomically, `guard_verification_insert` supersedes older submissions and forces re-uploads back to `pending`, and `submission_revision` marks resubmissions. The work is therefore ~90% frontend: a status filter bar + Resubmitted badge + archived Rejected view in `src/pages/dashboard/index.jsx` (residents section), extended banner copy in `resident-home`, one new server-side `verification_decision` notification insert, and a Playwright spec covering the full loop.

## Technical Context

**Language/Version**: JavaScript (React 18), SQL (PostgreSQL via Supabase), Deno/TypeScript (edge functions — unchanged)

**Primary Dependencies**: Vite 5, @supabase/supabase-js v2, Tailwind, lucide icons, Playwright

**Storage**: PostgreSQL via Supabase — `user_profiles`, `id_verifications` (status/revision/notes), `notifications`. No new columns required; see data-model.md.

**Testing**: Playwright e2e (existing `e2e/` specs + `helpers.js`)

**Target Platform**: Web SPA (Vite dev server on :4190)

**Project Type**: Web application — single React SPA + Supabase backend

**Performance Goals**: Tab switch instant from in-memory state; realtime re-file under 3s

**Constraints**: Admin-only surface (`residents` page key); `publishable` key cannot delete `id_verifications`/`user_profiles` (e2e cleanup caveat); free-tier email quota ~2-3/hour — in-app notification is the reliable leg

**Scale/Scope**: Single admin surface, 4 tabs, 1 notification type, 1 e2e spec; ~10-20 registrants typical

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **RLS security**: PASS — no policy changes needed; all decisions flow through `review_verification()` (admin-only, SECURITY DEFINER). New notification insert happens server-side, not via client.
- **Canonical roles**: PASS — feature is admin-only; registrant roles (resident/responder/dispatcher/department_admin) share one queue per FR-010.
- **Live-schema checks**: PASS — status enum, `submission_revision`, `decision_reason`, RPC, and guards verified against `20261030101000_verification_enforcement.sql`; tasks include a live probe before implementation.
- **Disciplined realtime**: PASS — one subscription on `id_verifications` for the residents section, re-deriving counts from existing state.
- **E2e coverage**: PASS — `e2e/registrant-filtration.spec.js` planned covering the full loop.
- **Build before push**: PASS — `npm run build` gate before every push.

No violations — Complexity Tracking not required.

## Project Structure

### Documentation (this feature)

```text
specs/003-registrant-filtration/
├── plan.md              # This file
├── research.md          # Phase 0 — all decisions resolved
├── data-model.md        # Phase 1 — entities reuse existing tables
├── quickstart.md        # Phase 1 — validation scenarios
├── contracts/           # Phase 1 — UI + RPC + notification contracts
│   └── registrant-review.md
├── checklists/
│   └── requirements.md  # spec-quality checklist (all green)
└── tasks.md             # /speckit.tasks output (next step)
```

### Source Code (repository root)

```text
src/
├── pages/
│   ├── dashboard/
│   │   └── index.jsx            # residents section: status tab bar + counts,
│   │                            # Resubmitted badge, archived Rejected view,
│   │                            # modal prior-note display, realtime counts
│   └── resident-home/
│       └── index.jsx            # VERIFICATION_COPY extended — banner names
│                                # what to re-upload (already shows note)
src/hooks/
└── useNotifications.js          # no change — surfaces new type automatically

supabase/
└── migrations/
    └── 20261110XXXXXX_verification_decision_notification.sql
                                 # notification row on non-approved decision
                                 # (RPC body insert or status-change trigger —
                                 #  decided at task level, server-side only)

e2e/
└── registrant-filtration.spec.js # NEW — tab counts, modal triage, returned
                                  # loop, Resubmitted badge, terminal archive
```

**Structure Decision**: Existing single-SPA + Supabase layout; the feature lands in the `residents` section of `src/pages/dashboard/index.jsx` (the live `/user-management` surface), one new migration, one new e2e spec. No new directories.

## Complexity Tracking

No constitution violations — section intentionally empty.
