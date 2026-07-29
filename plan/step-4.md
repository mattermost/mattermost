# Step 4 — Sunset Weblate

Parent: [summary.md](./summary.md) · Prev: [step-3.md](./step-3.md) ·
Related: [step-5.md](./step-5.md), [step-6.md](./step-6.md)

## Goal

Retire translate.mattermost.com as the translation source of truth for
the surveyed projects, without leaving contributors on contradictory
guidance or silently dropping WIP / plugin locales.

## Prerequisites

- Step 1 locale scope: **settled** — plugin drops already coordinated
  with product/comms; no further signoff gate.
- Step 2 bulk pass far enough that in-repo files are the quality baseline
  (or explicit interim policy).
- Community communications ownership: **resolved — no DRI required**;
  coordination is already done. Remaining comms tasks are announcements
  executed as part of this workstream.

## Surveyed Weblate projects (handbook)

Channels, Playbooks, Desktop, Mobile (v2), Calls — five projects. Confirm
no additional org projects before final archive.

## Concrete tasks

### 4.1 Inventory and owners

- [ ] List every Weblate project, webhook, and GitHub bot identity that
  can open locale PRs.
- [ ] Confirm webhook/docs artifacts (plan cited
  `docs/site/static/images/weblate-incoming-webhook.png` — **not found
  locally**; relocate or drop the reference).

### 4.2 Transition communications (before cutover)

- [ ] Publish deprecation / transition notice on translate.mattermost.com
  and community channels **before** disabling writes.
- [ ] Explicitly call out (these are announcements, not approval
  requests — the decisions are already coordinated):
  - End of Weblate as submission path
  - Retirement of WIP-language promotion pipeline (Beta × 3 releases +
    6 months language-expert commitment)
  - Calls/Playbooks locale adds/drops (not fine print)
- [ ] Confirm/replace handbook contacts (historically John Combs, Tom De
  Moor for language permissions).

### 4.3 Technical cutover

- [ ] Freeze Weblate writes (preferred before step 3 hard gates).
- [ ] Disable Weblate → GitHub webhook/integration.
- [ ] Verify no bot locale PRs land for a defined observation window.
- [ ] Invert/remove CI that rejects non-Weblate locale edits.
- [ ] Define rollback: re-enable webhook only if in-repo workflow is
      blocked; treat regenerated AI translations as recoverable.

### 4.4 Handbook and policy

Decision #6 revised: do **not** wait for "fully off" to start fixing
contradictory guidance.

- [ ] **During transition**: banner on handbook localization page —
  "submissions moving to GitHub; Weblate freezing on DATE".
- [ ] **After cutover**: full rewrite of
  `contributors/join-us/localization.md` reversing "don't submit
  translations via GitHub PRs".
- [ ] Update per-project Weblate list → one process, one locale list.
- [ ] Fold glossary/rule links into the new author/correction docs
  (steps 2–5).

### 4.5 Archive

- [ ] Archive or read-only the Weblate projects after observation window.
- [ ] Record final export/snapshot if needed for audit.

## Challenges (verification pass)

| Assumption | Verdict | Evidence / rationale |
|------------|---------|----------------------|
| Handbook only after fully off (#6) | **Revise** | Leaves "don't use GitHub" live while step 5 moves corrections to PRs. Use transition banner first. |
| One notice for WIP + plugin locale drops (#8) | **Revise** | Locale support removal needs explicit callouts and grace period. |
| Named individuals as owners (#11) | **Resolved — no DRI needed** | Coordination already complete; comms tasks execute within this workstream. |
| Regen makes Weblate clobber harmless (#14) | **Resolved — freeze first** | Owner confirmed: freeze writes first; AI translations supersede Weblate content. |
| Five Weblate projects are the full set | **Confirm** | Local workspace only has Calls/Playbooks plugins; org-wide inventory still required before archive. |

## Risks

- Community surprise / trust loss if WIP pipeline ends without dedicated
  messaging.
- Broken admin-console links to translate.mattermost.com if UI updates
  lag (step 6).
- Partial cutover: some projects frozen, others still writing.

## Acceptance criteria

- [ ] Transition notice published with dates and locale-impact callouts.
- [ ] Webhooks disabled; observation window clean.
- [ ] Handbook shows accurate in-transition or post-cutover guidance
  (never the old "PRs will be overwritten" without banner).
- [ ] Non-Weblate locale CI blocks removed/inverted.
- [ ] Rollback path documented.

## Open questions

1. ~~Role-owning DRI for sunset?~~ **Resolved: no DRI required —
   coordination already done.**
2. Separate WIP-pipeline notice and grace period?
3. Final list of Weblate projects org-wide?
4. Retention policy for Weblate history/glossary after archive?
