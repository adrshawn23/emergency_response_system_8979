---
description: End-to-end latent-issue audit — find, fix, build, and re-test async profile races, silent DB failures, and schema drift
---

# Latent-issue audit + verification cycle

End-to-end pass over `src/` for the three bug classes found in this project: unguarded `profile?.id` in Supabase calls, silent `if (!error)` state gates, and references to columns that don't exist in the live DB.

## 1. Sweep for unguarded `profile?.id` in queries

Search `src/` for `profile?.id` and inspect every hit where the value feeds a Supabase call on mount (useEffect) or in a handler:

- `.eq('col', profile?.id)` inside a `useEffect` fires `eq.undefined` (400) before the profile loads — gate the effect body with `if (!profile?.id) return;` and keep `[profile?.id]` as the dependency so it refires when the profile arrives.
- Realtime `filter: `...eq.${profile?.id}`` has the same bug — a subscription created with `eq.undefined` never receives rows. The early-return guard fixes it too.
- Handler-level `profile?.id` (inserts/updates) needs a guard + user-facing message, e.g. `setError('Profile is still loading — try again in a moment.')`, plus `disabled={!profile?.id}` on the submit button.
- `profile?.id` used only for client-side `.filter()` over already-loaded data is harmless — skip those.

## 2. Sweep for silent `!error` gates

Search `src/` for `if (!error)`. Every one is a candidate silent failure:

- Convert to `if (error) { console.error('<action> failed:', error); return; }` followed by unconditional success-path code. Match existing codebase style (`console.error`, not alerts).
- If the UI gives no feedback on failure at all (button does nothing, stale row stays), surface the error in state and render it near the control (pattern: `contactError`/`submitError` red banner in `src/pages/dashboard/index.jsx`).

## 3. Sweep for schema drift

The live `user_profiles` columns are: `account_status, address, avatar_url, birthdate, created_at, department_id, email, employee_id, first_name, full_name, id, last_name, phone, role, status, updated_at`. NOT present: `is_active, approved_at, approved_by, phone_number`.

- Search `src/` for `phone_number|is_active|approved_at|approved_by`.
- `profile?.phone_number` → `profile?.phone`. PostgREST won't error (the value lands inside a JSONB `attachments` blob) — it silently writes `undefined`.
- `phone_number` on `emergency_contacts` and `is_active` on `departments` are real columns — leave them.
- Missing-column references inside a top-level `.update()`/`.insert()` payload DO fail the whole call, silently if gated by `!error`.

## 4. Verify the fixes compiled on disk

// turbo
4a. Run `npm run build` from the project root (`emergency_response_system_8979-main`). Do NOT run `npm start` — that boots the dev server into this terminal.

4b. If esbuild reports a transform error pointing at mangled text (e.g. `ifcon ol(.error(...)`), the file on disk diverged from the edit tool's view — re-read the file with `Get-Content` / `read_file`, repair the corrupted block by exact-match edit, and rebuild.

## 5. Ensure the dev server is up

Playwright specs need `http://localhost:4190`.

// turbo
5a. Probe it: `try { (Invoke-WebRequest -Uri 'http://localhost:4190' -UseBasicParsing -TimeoutSec 5).StatusCode } catch { "DOWN" }`

5b. If down, start it in the background: `npm start`. Known crash: `EBUSY` on `dist/assets/images/no_image.png` happens when a production build writes `dist/` while vite watches it — just restart `npm start` afterwards.

## 6. Rerun the affected specs

Run only the specs that exercise the changed code paths; widen to the full suite (`npx playwright test`) if a core file changed:

- `src/pages/dashboard/index.jsx` → `npx playwright test e2e/full_ui_buttons.spec.js e2e/geofence.spec.js e2e/test_guide_extra.spec.js`
- `src/pages/responder-view/index.jsx` → `npx playwright test e2e/workflow.spec.js` plus `-g "responder: board"` on `e2e/full_ui_buttons.spec.js`
- `src/pages/emergency-report/index.jsx` → `npx playwright test e2e/geofence.spec.js e2e/workflow.spec.js`
- Route/auth context changes → run the full suite.

A `page.goto('/')` timeout on the login page is a dev-server flake, not a code failure — rerun the spec file before investigating.

## 7. Report

Summarize: issues found per bug class, files/lines changed, build status, and spec results (pass counts + any infra-flake reruns).
