# Contracts: New Registrant Filtration

**Feature**: `003-registrant-filtration` | **Date**: 2026-11-10

## 1. Server contract — `review_verification()` (existing, unchanged)

```
review_verification(p_verification_id uuid, p_decision text, p_reason text)
  p_decision ∈ { 'approved' | 'rejected' | 'needs_clarity' | 'correction_required' }
  p_reason  required for every decision except 'approved'
  returns   { verification_id, user_id, decision, revision }
  errors    non-admin caller | superseded submission | missing reason
```

New requirement layered on it: a **notification side-effect** for non-approved decisions — implemented either as an additional insert inside the RPC body or a DB trigger on `id_verifications` status change. Decision made at task level; client-side insert is NOT acceptable (untrusted + races the transactional update).

## 2. UI contract — status filter bar

```text
Tabs: [ For Approval (n) | Returned (n) | Approved (n) | Rejected (n) ]
Default: For Approval
Mapping: For Approval ← pending|under_review|no-verification-row pending registrants
         Returned     ← needs_clarity|correction_required
         Approved     ← approved
         Rejected     ← rejected (archived styling, no actions)
```

- Row → click → existing review modal (decisions inside modal only).
- For Approval row with `submission_revision > 1` → **Resubmitted** badge; modal includes the prior `decision_reason`/`review_notes`.
- Empty tab → explicit empty state.

## 3. Notification contract

```text
recipient_id: verification user_id        # bell reads recipient_id=eq.<uid>
type:         'verification_decision'
title:        'ID verification — action needed' (needs_clarity/correction_required) | 'Registration not approved' (rejected)
message:      reviewer clarification note / decision reason
action_url:   '/' (resident home → verification card)
metadata:     { verification_id, verification_status, submission_revision }
```

Note: the table has both `user_id` and `recipient_id`; the bell + RLS use `recipient_id`. SECURITY DEFINER trigger populates `recipient_id` and also `user_id` for consistency with existing rows (check live convention at implement time — some rows may set both).

## 4. Registrant banner contract (existing surface, extended)

`VERIFICATION_COPY` in `resident-home/index.jsx` already maps status → label/text; the clarification note (`decision_reason`/`review_notes`) renders beneath. Extension: when a note exists, banner explicitly states "what to re-upload" wording per the note.
