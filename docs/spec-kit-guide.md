# Spec Kit Guide — Kalubihan Emergency Response System

Persistent reference for the GitHub Spec Kit (Spec-Driven Development) setup
in this repo. Installed 2026-11-08. CLI: `specify` v1.3.2 (Python 3.12.10,
via `uv tool install specify-cli`).

## What Spec Kit Is

GitHub's toolkit for Spec-Driven Development: a written spec is the source
of truth, and the coding agent is guided through staged artifacts instead of
jumping to code. The `specify` CLI scaffolds `.specify/` + agent command
files into a repo; the workflow itself runs as agent-chat skills
(`/speckit.*` — here they live in `.windsurf/workflows/` and are invoked by
name, e.g. `/speckit.specify`).

## Three Independent Processes

- **SDD (core)** — feature workflow (below).
- **Bug fixing** — `specify extension add bug`, then
  `/speckit.bug-assess -> bug-fix -> bug-test`; verdict
  `verified | partial | failed`; artifacts in `.specify/bugs/<slug>/`.
- **Idea assessment** — `specify extension add assess`, then
  `/speckit.assess-intake -> research -> define -> shape -> decide`;
  verdict `go | needs-clarification | kill`; artifacts in
  `.specify/assessments/<slug>/`. On `go`, hand `decision.md` to specify.
- Custom processes via extensions/presets/workflows/bundles/catalogs
  (`specify extension search`, etc.).

## SDD Workflow (in agent chat, one at a time, review each result)

| Step | Command | Output | Required? |
|---|---|---|---|
| Constitution | `/speckit.constitution` | `.specify/memory/constitution.md` | Once per project — DONE (v1.0.0) |
| Specify | `/speckit.specify <description>` | `specs/NNN-slug/spec.md` + `checklists/requirements.md` | Yes — WHAT/WHY only, no tech stack |
| Clarify | `/speckit.clarify [focus]` | Resolves `[NEEDS CLARIFICATION]` markers | Optional, before plan |
| Plan | `/speckit.plan <stack/architecture>` | `plan.md` + design artifacts | Yes — HOW belongs here |
| Checklist | `/speckit.checklist` | Reviewer-owned quality checklist | Optional, after plan |
| Tasks | `/speckit.tasks` | `tasks.md` — dependency-ordered | Yes |
| Analyze | `/speckit.analyze` | Read-only consistency report | Optional, before implement |
| Implement | `/speckit.implement [phase]` | Executes tasks.md in order | Yes — gates on checklists |
| Converge | `/speckit.converge` | Verifies code vs spec; appends gap tasks | Yes — repeat until `Converged` |

## Repo Layout After Adoption

- `.specify/memory/constitution.md` — ERS constitution v1.0.0 (RLS-first,
  role lifecycle, live-schema-beats-migrations, slim-list payloads,
  realtime discipline, change discipline, test-verified claims).
- `.specify/templates/` — spec/plan/tasks/checklist/constitution templates.
- `.specify/scripts/powershell/` — `resolve-template.ps1`,
  `create-new-feature.ps1`, `setup-plan.ps1`, `setup-tasks.ps1`,
  `check-prerequisites.ps1`, `common.ps1`.
- `.specify/workflows/` + `integrations/` — runtime registry, generic
  integration manifest.
- `.windsurf/workflows/speckit.*.md` — the 9 command prompts Cascade runs.
- `specs/<NNN>-<slug>/` — created per feature (spec.md, plan.md, tasks.md,
  checklists/).

## How Cascade Executes It

No native Cascade/Windsurf integration key exists — this repo used
`--integration generic` with `--commands-dir .windsurf/workflows`. The
generated files are already in Windsurf workflow format (frontmatter +
steps + `$ARGUMENTS`), so each `/speckit.*` command runs as a normal
workflow. Extension hooks in `.specify/extensions.yml` fire as
`EXECUTE_COMMAND` markers inside those files; honor them if extensions are
added later.

## Verified Commands Used

```powershell
# install (one-time, done)
winget install -e --id Python.Python.3.12 --accept-source-agreements --accept-package-agreements
winget install -e --id astral-sh.uv --accept-source-agreements --accept-package-agreements
uv tool install specify-cli
uv tool update-shell            # puts %USERPROFILE%\.local\bin on PATH
specify version                 # -> 1.3.2

# adopt into this repo (done; all-new files, nothing overwritten)
specify init --here --force --integration generic --script ps --non-interactive --ignore-agent-tools `
  --integration-options="--commands-dir .windsurf/workflows"
```

Upgrade later: `uv tool install --force specify-cli` (re-install from
PyPI), then `specify` in-repo per its upgrade guide.

## Reusable Checklist for Future Tasks

1. Understand the request; locate the spec (`specs/`) or run
   `/speckit.specify` for new work.
2. Check `.specify/memory/constitution.md` — the seven ERS principles are
   binding.
3. `/speckit.clarify` ambiguities (max 3 `[NEEDS CLARIFICATION]`).
4. `/speckit.plan` — must reuse existing architecture: React+Vite,
   Supabase RLS/RPC, slim view for lists, unique realtime channels.
5. `/speckit.tasks` + `/speckit.analyze` — fix flagged issues at source.
6. Implement only after user approval; Playwright e2e for affected flows.
7. `npm run build` + relevant `npm test` before any push.
8. `/speckit.converge` — repeat implement until `Converged`.
9. Report: spec vs implementation, tests actually run, remaining gaps.

## Known Limitations

- `specify` CLI is Python-bound — installed system-wide via winget/uv, not
  a repo dependency. Other machines need the same install steps.
- Bug/assess extensions not yet installed
  (`specify extension add bug|assess` when needed).
- Git extension skipped — repo already uses git; spec dirs are independent
  of branch names (`.specify/feature.json` tracks the active feature).
- Live Supabase schema still outranks migration files (constitution III).
