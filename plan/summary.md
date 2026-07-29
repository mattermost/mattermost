# AI-Driven i18n Overhaul — v12

Status: draft, iterating. Split from monolithic `PLAN.md` after a
verification pass that challenged several locked decisions.

## Goal

Move translation ownership from a community-driven Weblate pipeline to an
AI-assisted, source-of-truth-in-repo model. Every supported locale reaches
100% coverage once (paid for in Cursor/Fable credits), and stays at 100%
because new strings ship with their translations in the same PR.

## Plan index

| Step | File | Focus |
|------|------|--------|
| 1 | [step-1.md](./step-1.md) | Lock the 22-locale list; trim, normalize, lint scaffolding |
| 2 | [step-2.md](./step-2.md) | One-time bulk AI translation + review |
| 3 | [step-3.md](./step-3.md) | Author-submitted translation workflow + CI gates |
| 4 | [step-4.md](./step-4.md) | Sunset Weblate |
| 5 | [step-5.md](./step-5.md) | Community/customer correction workflow |
| 6 | [step-6.md](./step-6.md) | Docs / tooling / agent-guidance cleanup |

## Scope (surveyed surfaces)

Six product lines, **nine i18n surfaces** (the plan's "six codebases"
shorthand undercounts loaders):

| Surface | Approx. `en` entries | Locale files today |
|---------|---------------------:|-------------------:|
| Webapp (`channels`) | 8,079 | 64 |
| Server | 3,495 | 55 |
| Mobile JS | 1,718 | 64 |
| Desktop | 367 | 64 |
| Calls webapp / standalone / server | 349 / 2 / 14 | 24 each |
| Playbooks webapp / assets | 763 / 47 | 23 / 18 |

Enterprise has no i18n surface. Android native strings are admin/EMM-only
and not localized. iOS `.lproj` wiring is a separate pre-existing bug
(out of scope — see step 1).

**Supported locale set (22)** — same codes in webapp, server, mobile, and
desktop:

`bg`, `de`, `en`, `en-AU`, `es`, `fa`, `fr`, `hu`, `it`, `ja`, `ko`, `nl`,
`pl`, `pt-BR`, `ro`, `ru`, `sv`, `tr`, `uk`, `vi`, `zh-CN`, `zh-TW`

Calls and Playbooks currently use **different** locale lists and will be
reconciled onto the core 22 (coordination with product/community owners
already complete).

## Current state (compressed)

- **Source of truth today**: `en.json` is hand-maintained / extracted.
  Other locales are Weblate-managed; contributor docs still say not to
  edit them on GitHub.
- **No key-parity CI**: existing checks are mostly `en.json` extract-drift
  and a workflow that *blocks* non-Weblate locale edits. Webapp already
  has an unwired `i18n-verify-translations` (`formatjs verify`).
- **Filename conventions are mixed**, not a clean hyphen-vs-underscore
  split: mobile/desktop mix both; Calls/Playbooks also use `zh_Hans` /
  `zh_Hant`.
- **Quality labels** (Alpha/Beta) disagree across surfaces for the same
  locale.
- **Playbooks `zh_Hant`**: ~548 keys byte-identical to English, plus
  missing/extra key drift — invisible to a naive "key exists" coverage
  check.
- **No translator context** in shipped `en.json` (formatter drops
  `description`; authors rarely set it). Runtime consumers require flat
  `string` values — metadata must stay in a separate authoring-tier
  artifact.
- **Two syntax families**: ICU / react-intl on JS; Go `{{.Field}}` +
  plural maps on server. Two toolchains: `mmjstool` / `formatjs`, and
  `mmgotool` (Calls vs Playbooks even install *different* mmgotool
  modules).

## Locked decisions (with challenge status)

Status after verification pass: **keep** / **revise** / **reopen**.

| # | Decision | Status |
|---|----------|--------|
| 1 | Keep exactly the current 22 locales; force Calls/Playbooks onto that set; drop experimental/non-matching files | **Keep** — product/comms coordination confirmed complete, including plugin-only locale drops (`ar`/`cs`/`hr`/…, `kk`/`ml`/…); proceed with deletions |
| 2 | Authors submit AI translations in the same PR; no CI auto-translator near-term | **Keep — resolved**: strict same-PR, backed by a documented generator; locale diffs get **no human review** (CI gates are the sole check) |
| 3 | Unify all surveyed surfaces on the same 22-locale list and coverage bar | **Keep** |
| 4 | Trim locales before bulk AI spend | **Keep** |
| 5 | Review methodology: back-translation only | **Reject as sole review** — must add native sampling / identical-copy gates; back-translation misses copy-English and register |
| 6 | Handbook rewrite only after Weblate fully off | **Revise** — need a transition banner *before* cutover so guidance isn't contradictory |
| 7 | Standardize filenames on hyphens (`en-AU.json`) | **Keep as product convention**; treat `zh_Hans`→`zh-CN` as compatibility mapping, not BCP-47 purity |
| 8 | Fold WIP/Calls/Playbooks retirement into one Weblate notice | **Revise** — locale drops need explicit callouts, not fine print |
| 9 | iOS `.lproj` gap out of scope | **Keep** — file separately |
| 10 | No hard Cursor/Fable credit cap | **Keep — resolved**: unlimited spend, no budget requirements or checkpoint |
| 11 | Katie Wiersgalla & Amy Blais own Weblate sunset comms | **Resolved** — no DRI required; coordination already complete, comms are announcements executed in step 4 |
| 12 | Dropped-locale fallback → `en` | **Keep**, with explicit migration tests |
| 13 | Syntax linters: `formatjs verify` (JS) + new `mmgotool i18n verify` (Go) | **Revise** — `--extra-keys` is **not** a formatjs flag on current CLIs; plugin `@formatjs/cli` versions may lack `verify`; mmgotool release path is split |
| 14 | Weblate overlap with author PRs is fine (regen is cheap) | **Resolved** — freeze Weblate writes first; AI translations supersede Weblate content thereafter |
| 15 | Full per-key context (source grep) for bulk pass | **Revise** — cache once per source key, batch by component; don't block on full metadata tooling |
| 16 | Build glossaries now as hard constraints | **Revise** — treat as high-priority constraints with conflict reporting; sources are prose rules, not clean term maps |
| 17 | Two-tier authoring vs runtime format; never change shipped JSON shape | **Keep** architecture; **defer** full tooling hardening past the minimum needed for step 2 |

## Explicitly out of scope

- Automated CI-side translation generation (bot) — deferred.
- Automated quality *scoring* of author-submitted translations — later.
- iOS native `.lproj` permission-string wiring — separate ticket.
- Org-wide plugin inventory beyond Calls/Playbooks — must be confirmed
  before final Weblate shutdown, but not part of the first engineering
  cutover in the surveyed repos.

## Cross-cutting risks

1. **Locale set ≠ shipped files ≠ imports** — three different concepts
   already drift today (`imports.ts` vs JSON on disk vs supported list).
2. **CI gap is misdiagnosed if called "no i18n CI"** — checks exist; they
   don't enforce cross-locale parity, ICU/template integrity, or
   identical-to-English spikes.
3. **`en-AU` breaks naive identical-to-English gates** (~84–92% identical
   is normal for that locale).
4. **mmgotool is not one binary**: platform vendors a copy; Calls installs
   `mattermost/tools/mmgotool@latest`; Playbooks pins
   `mattermost-utilities/mmgotool`.
5. **Community attrition**: replacing Weblate UI with GitHub PRs raises
   the bar for non-engineer translators.

## Sequencing (intended)

```
step-1 (trim + normalize + minimum validators)
   → step-2 (bulk translate in waves)
   → step-4 freeze Weblate writes (decided: freeze before gates)
   → step-3 author workflow + CI

   → step-5 correction intake
   → step-6 docs/UI/agent cleanup (phased; transition notices earlier)
```

## How to use this plan

- Prefer the step files for execution checklists and acceptance criteria.
- Locale scope (decision #1) is settled — product/comms coordination is
  already done, so locale drops are unblocked. Remaining **Reopen /
  Revise** rows are engineering-level (tooling flags, review methodology,
  sequencing), resolvable within the workstreams.
- Keep investigation evidence in the step files' "Challenges" sections;
  do not silently re-lock rejected assumptions.
