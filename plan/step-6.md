# Step 6 — Docs / tooling / agent-guidance cleanup

Parent: [summary.md](./summary.md) · Prev: [step-5.md](./step-5.md)

## Goal

Remove stale Weblate-centric guidance from product UI, contributor docs,
developer docs, and agent instruction files — phased so contributors are
never told two contradictory things without a transition banner.

## Prerequisites

- Step 4 transition dates known.
- Step 3 author workflow docs drafted (can land in parallel).
- Inventory of stale references (below).

## Known stale references (verified / surveyed)

| Location | What it still says |
|----------|--------------------|
| `docs/develop/contribute/why-contribute/index.md` | Use Weblate / translation server; not GitHub |
| `docs/develop/contribute/more-info/webapp/developer-workflow.md` | Only modify `en.json`; other languages via Weblate |
| Admin console localization UI | Links to `translate.mattermost.com`; exposes `EnableExperimentalLocales` |
| Webapp / server config | Experimental locales plumbing |
| Webapp / desktop language lists | Alpha/Beta labels |
| `mattermost-mobile/CLAUDE.md` | Never modify non-`en` locale files |
| `mattermost-mobile/scripts/precommit/i18n.sh` | Weblate-oriented comment |
| `webapp/CLAUDE.OPTIONAL.md` | i18n guidance to revisit |
| `server/AGENTS.md` / platform agent docs | `make i18n-extract` expectations |
| Handbook localization page (external repo) | Don't submit translations via GitHub PRs |
| Plan-cited webhook screenshot path | **Not found locally** — confirm or delete reference |

Note: root `CONTRIBUTING.md` files in several repos may **not** mention
Weblate even when developer docs do — search broadly (`Weblate`,
`translate.mattermost.com`, `experimental locales`).

## Concrete tasks

### 6.1 Phase A — Transition (before or at Weblate freeze)

- [ ] Add banners / callouts: Weblate freezing on DATE; new submission
  path is GitHub (link step 3 + step 5).
- [ ] Soften "do not edit locale files" language to "during transition,
  coordinate with DRI".

### 6.2 Phase B — Cutover

- [ ] Remove Weblate submission instructions from contributor docs.
- [ ] Update developer workflow: PRs that change strings must include
  all supported locale updates (or the approved follow-up pattern from
  step 3 open questions).
- [ ] Update admin console copy and help links away from
  `translate.mattermost.com` once the service is frozen/archived.
- [ ] Remove or repurpose `EnableExperimentalLocales` UI once step 1
  removes the flag.

### 6.3 Phase C — Agent & tooling docs

- [ ] `platform/AGENTS.md` / `server/AGENTS.md`: author-submits-
  translations expectation; new verify make targets.
- [ ] Mobile `CLAUDE.md` + precommit script comments.
- [ ] Desktop / Calls / Playbooks agent or contributing notes if present.
- [ ] Document generator script usage for Cloud/Cursor agents.

### 6.4 Phase D — Final gate

- [ ] `rg -i 'weblate|translate\\.mattermost\\.com'` across surveyed
  repos (and handbook) is clean except historical changelog entries.
- [ ] Alpha/Beta labels **removed** from all language lists (decided —
  all 22 locales meet the same bar after the bulk pass).
- [ ] WIP promotion pipeline docs removed from handbook.

## Challenges (verification pass)

| Assumption | Verdict | Evidence / rationale |
|------------|---------|----------------------|
| Docs cleanup after code cutover only | **Revise** | Product UI and contributor docs still point at Weblate — sequence in phases. |
| CONTRIBUTING.md is the main doc debt | **Incomplete** | Much guidance lives in `docs/develop/...`, admin UI, and agent files. |
| Handbook is in this monorepo | **False** | `mattermost-handbook` not in `/agent/repos`; track as external deliverable. |
| Enterprise/other plugins need doc updates | **Scoped** | Enterprise has no i18n; still confirm org plugins before claiming global Weblate retirement in public docs. |

## Risks

- Orphaned links to translate.mattermost.com after archive.
- Agents (Cursor/Claude rules) keep teaching the old "en.json only"
  workflow and undo step 3.
- Public handbook lags private repo docs.

## Acceptance criteria

- [ ] Phase A banners live before Weblate write freeze.
- [ ] Post-cutover docs describe GitHub PR + issue correction paths only.
- [ ] Admin console no longer sends admins to a dead Weblate for
  contributions (or explains archive status).
- [ ] Agent instruction files match the new workflow.
- [ ] Final ripgrep gate passes on surveyed repos.

## Open questions

*(none remaining for step 6.)*

Resolved: D4 (drop Alpha/Beta), D18 (handbook timing out of band — not a
plan gate). No separate public status page required beyond the combined
Weblate notice (step 4).
