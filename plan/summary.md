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
| — | [glossary.md](./glossary.md) | In-repo glossary model + Weblate/handbook import path |
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
| 5 | Review methodology: back-translation only | **Reject as sole review** — add native sampling; back-translation misses copy-English and register. A one-time identical-to-`en` scan during the bulk pass finds existing bad files; **no ongoing CI gate** (decided) |
| 6 | Handbook rewrite only after Weblate fully off | **Superseded by D18** — handbook banner/rewrite is out of band; not a gate for engineering cutover |
| 7 | Standardize filenames on hyphens (`en-AU.json`) | **Keep as product convention**; treat `zh_Hans`→`zh-CN` as compatibility mapping, not BCP-47 purity |
| 8 | Fold WIP/Calls/Playbooks retirement into one Weblate notice | **Resolved** — one combined notice with explicit sections; no grace period; no separate WIP notice |
| 9 | iOS `.lproj` gap out of scope | **Keep** — file separately |
| 10 | No hard Cursor/Fable credit cap | **Keep — resolved**: unlimited spend, no budget requirements or checkpoint |
| 11 | Katie Wiersgalla & Amy Blais own Weblate sunset comms | **Resolved** — no DRI required; coordination already complete, comms are announcements executed in step 4 |
| 12 | Dropped-locale fallback → `en` | **Keep**, with explicit migration tests |
| 13 | Syntax linters: `formatjs verify` (JS) + new `mmgotool i18n verify` (Go) | **Revise tooling details, path settled**: `--extra-keys` is not a FormatJS flag (custom check); plugin CLI upgrades may be needed. **Canonical mmgotool** is platform-vendored `mattermost/tools/mmgotool`; migrate Playbooks off `mattermost-utilities` |
| 14 | Weblate overlap with author PRs is fine (regen is cheap) | **Resolved** — freeze Weblate writes first; AI translations supersede Weblate content thereafter |
| 15 | Full per-key context (source grep) for bulk pass | **Revise** — cache once per source key, batch by component; don't block on full metadata tooling |
| 16 | Build glossaries now as hard constraints | **Resolved** — in-repo glossary at `i18n/glossary/` (see [glossary.md](./glossary.md)); handbook DE/FR/NL authoritative soft/`required` constraints; Weblate CSV filtered (Mattermost EN dump is ~28k polluted rows — do not import wholesale); no CI glossary enforcement in v12 |
| 17 | Two-tier authoring vs runtime format; never change shipped JSON shape | **Keep** architecture; **defer** full tooling hardening past the minimum needed for step 2 |

## Explicitly out of scope

- Automated CI-side translation generation (bot) — deferred.
- Automated quality *scoring* of author-submitted translations — later.
- iOS native `.lproj` permission-string wiring — separate ticket.
- Org-wide Weblate project inventory — **already checked** (D16); instance
  has Mattermost / Playbooks / Calls only (desktop/mobile are Mattermost
  components).

## Cross-cutting risks

1. **Locale set ≠ shipped files ≠ imports** — three different concepts
   already drift today (`imports.ts` vs JSON on disk vs supported list).
2. **CI gap is misdiagnosed if called "no i18n CI"** — checks exist; they
   don't enforce cross-locale parity or ICU/template integrity.
3. **Accepted risk (decided)**: with no identical-to-English gate and no
   human review of locale diffs, an English string copy-pasted into all
   22 locales passes CI silently; the correction workflow (step 5) is the
   recourse.
4. **mmgotool path settled**: canonical is platform
   `mattermost/tools/mmgotool`; Playbooks must migrate off
   `mattermost-utilities/mmgotool` before it can consume `i18n verify`.
5. **Community attrition**: replacing Weblate UI with GitHub PRs raises
   the bar for non-engineer translators (mitigate via step 5 issue +
   support-ticket paths).

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
- Product/comms decisions are settled. Remaining engineering follow-through
  lives in the step checklists (FormatJS flags, mmgotool Playbooks
  migration, glossary import phases).
- Glossary work is specified in [glossary.md](./glossary.md) and gates
  the step 2 pilot.
- Keep investigation evidence in the step files' "Challenges" sections;
  do not silently re-lock rejected assumptions.

## Decision log (iteration resolutions)

| ID | Resolution |
|----|------------|
| D1 | Delete dropped/experimental locale JSON immediately |
| D2 | Rename Chinese on disk to `zh-CN`/`zh-TW`; no alias layer |
| D3 | Treat `en-AU` like any other locale; let translation do the right thing |
| D4 | Drop Alpha/Beta labels |
| D5 | Canonical `mmgotool` = platform `mattermost/tools/mmgotool` |
| D6 | Identical-copy CI gate **deleted**; one-time bulk-pass scan only |
| D7 | Owner accepts back-translation + sampling as sufficient review now |
| D8 | Handbook DE/FR/NL rules authoritative (soft/`required` constraints) |
| D9 | AI reviews/rewrites **all** existing strings in the bulk pass |
| D10 | Unlimited spend; no budget checkpoint |
| D11 | No human reviewers of locale diffs |
| D12 | Strict same-PR for translations |
| D13 | Freeze Weblate before gates; AI supersedes Weblate content |
| D14 | No DRI required for sunset comms |
| D15 | One combined Weblate/WIP/locale-drop notice |
| D16 | No further org Weblate inventory — already checked |
| D17 | Model glossary in-repo; export/import from Weblate + handbook |
| D18 | Handbook banner/rewrite executed out of band (not a plan gate) |
| D19 | Correction triage best-effort by repo maintainers; no formal SLA |
| D20 | Corrections via GitHub issues **and** support tickets |
