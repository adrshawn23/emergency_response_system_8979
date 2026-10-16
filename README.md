# Barangay Kalubihan Emergency Response System

A responsive command, resident, and responder interface for receiving emergency reports, dispatching the right department, and tracking targeted assistance requests.

## Included workflows

- Role-aware resident, dispatcher/admin command center, and responder views
- Emergency reports with optional GPS, manual fallback, media, and outside-service-area triage flagging
- Configurable/persisted service-boundary data model with audit-friendly versioning
- Targeted department assistance workflow with confirmation and acknowledgement-oriented UI
- Administrator-only route protection for users, departments, department memberships, and settings
- Registration with private-ID/AI-review data model; OCR outcomes are always human-reviewable
- Supabase migration for the relational incident, membership, notification, verification, audit, and retention model

## Run locally

```bash
npm install
npm start
```

The project enters mock mode automatically without `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` (the legacy `VITE_SUPABASE_ANON_KEY` is also supported). Test accounts are defined in `src/data/mockData.js` (for example, `dispatcher1@emergency.gov`, `resident1@example.com`, and `responder1@emergency.gov`; mock mode accepts any password for active accounts).

Build with:

```bash
npm run build
```

If the Rocket visual-editor tagger cannot access parent folders in a constrained environment, build with `VITE_DISABLE_TAGGER=1`.

## Required production setup

Apply both migrations in `supabase/migrations/`. Configure HTTPS and private Supabase Storage buckets before accepting ID or incident-media files. The application intentionally does not expose raw document paths publicly.

These integrations require configuration and are not claimed to be active in mock mode:

- **Maps/GIS:** provide the administrator-approved Barangay Kalubihan boundary polygon. The UI's demo polygon is illustrative only.
- **OCR/AI:** connect an approved OCR provider server-side, save field-level results and confidence to `registration_documents`, and send mismatch/low-confidence/unreadable results to an administrator. Never use ID images for face matching or model training.
- **SMS, email, and push:** configure provider credentials and delivery webhooks. Sent, delivered, and acknowledged must remain distinct states.

Local emergency phone services remain the fallback for urgent emergencies and for offline or provider-unavailable states.
