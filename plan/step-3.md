# Step 3 — Author-submitted translation workflow + CI gates

Parent: [summary.md](./summary.md) · Prev: [step-2.md](./step-2.md) ·
Next: [step-4.md](./step-4.md)

## Goal

Make "translations ship in the same PR as `en.json` changes" the default
across surveyed repos, enforced by deterministic CI — without a CI-side
translation bot in v12.

## Prerequisites

- Step 1 locale/filename normalization for the repo being gated.
- Step 2 prompts/bundle tooling reusable for **diff-sized** author runs.
- **Prefer Weblate write-freeze before hard gates** (decision #14 reopen).

## Concrete tasks

### 3.1 Freeze Weblate writes for target repos

- [ ] Disable or pause Weblate → GitHub updates for surfaces about to
  enforce author-submitted locale files (coordinate with step 4).
- [ ] Do not rely on "regen is cheap" to absorb clobbers of reviewed
  glossary-constrained strings.

### 3.2 Author workflow (human-facing)

- [ ] Document the exact generator path (script/prompt/Cursor skill)
      scoped to changed keys in the PR's `en.json` diff.
- [ ] Update PR templates / developer docs across platform, mobile,
      desktop, Calls, Playbooks.
- [ ] Rewrite mobile `CLAUDE.md` rule that currently forbids editing
      non-`en` locale files.
- [ ] Update platform docs that still say only `en.json` should be
      modified (e.g. webapp developer-workflow) — full sweep in step 6.

### 3.3 JS CI: FormatJS verify (corrected)

Verified: core webapp `@formatjs/cli` supports `verify` with
`--missing-keys` and `--structural-equality`. **`--extra-keys` is not a
real flag** on surveyed CLIs — plan a custom extra-key diff instead.

- [ ] Wire webapp `i18n-verify-translations` into CI (today only extract
  drift runs).
- [ ] Add `@formatjs/cli` to mobile and desktop; add equivalent scripts.
- [ ] Upgrade Calls/Playbooks CLI packages if they lack `verify`.
- [ ] Add custom check for unexpected extra keys vs `en`.

### 3.4 Go CI: mmgotool verify

Today `mmgotool` exposes `extract` / `check` / `check-empty-src` /
`clean-empty` — **no `verify`**.

- [ ] Implement `mmgotool i18n verify`: parse `text/template`, diff
  `{{.Field}}` tokens vs `en`, validate plural maps.
- [ ] Publish via the **canonical** module path; bump Calls (`@latest` or
  pin) and Playbooks (`mattermost-utilities` pin — may need repo
  alignment).
- [ ] Until plugins can adopt it, run equivalent checks in-repo or accept
  temporary platform-only coverage with an explicit gap list.

### 3.5 Identical-to-source heuristic (thresholded)

Do **not** hard-fail every byte-identical value:

| Locale example | Approx. identical-to-`en` rate (surveyed) |
|----------------|-------------------------------------------:|
| `en-AU` (webapp/server/mobile/desktop) | ~84–92% (normal) |
| `fr` (webapp / Playbooks) | ~3–6% (baseline) |
| Playbooks `zh_Hant` (bad) | pathological spike |

- [ ] Allowlist brands, product names, `{vars}`, URLs, commands.
- [ ] Special-case English variants (`en-AU`).
- [ ] Start as **warn** or fail only on file-level spikes / full-sentence
  copies; tighten later.
- [ ] This gate is orthogonal to structural-equality (copy-English is
  syntactically perfect).

### 3.6 CI rollout

- [ ] Roll repo-by-repo after that repo's filenames + tool versions are
  ready.
- [ ] Extend Calls' existing `i18n-check` (extract drift + empty strings)
  rather than replacing it blindly.
- [ ] Retire or invert the workflow that currently **blocks** non-Weblate
  locale file edits (`i18n-ci-template` style checks).

## Challenges (verification pass)

| Assumption | Verdict | Evidence / rationale |
|------------|---------|----------------------|
| Authors own 22 locales per string PR (#2) | **Reopen** | High DX and review load; low-signal diffs especially for `en-AU`. Consider helpers, batched i18n follow-up PRs, or reviewer guidance. |
| No CI translator | **Accept + guardrails** | Still need a local/scripted generator — "just use AI" is not a workflow. |
| `formatjs verify --extra-keys` (#13) | **Reject as stated** | Flag does not exist on pinned CLIs; implement custom extra-key check. |
| Plugin FormatJS parity | **Reopen** | Older `@formatjs/cli` pins may not expose `verify`. |
| Identical-to-`en` hard fail | **Reopen** | `en-AU` makes absolute fail unusable; use thresholds. |
| mmgotool one release path | **Reopen** | Platform vendored vs Calls `@latest` vs Playbooks utilities pin. |
| Weblate overlap OK (#14) | **Reopen** | Freeze writes before enforcing author locale commits. |

## Risks

- Giant localization hunks bury product review.
- Authors skip generator and paste English into 22 files — passes key
  parity without identical-copy gate.
- Weblate bot fights author PRs during overlap.
- Plugins lag on tool upgrades → uneven enforcement.

## Acceptance criteria

- [ ] Documented author generator works on a sample string-change PR.
- [ ] Mobile `CLAUDE.md` (and equivalents) no longer forbid locale edits.
- [ ] CI fails on missing keys for gated repos.
- [ ] CI runs structural/template checks appropriate to JS/Go.
- [ ] Identical-to-source policy documented with `en-AU` exemption /
  threshold.
- [ ] Weblate no longer overwrites gated locale paths (or overlap risk
  accepted in writing by owners).

## Open questions

1. Is `en-AU` required to diverge, or mostly inherit `en` with a small
   overlay?
2. Who reviews 22-locale AI diffs in product PRs?
3. Hard gate start date vs Weblate freeze date?
4. Canonical `mmgotool` module path going forward?
5. Allowed pattern: product PR lands `en` only + follow-up translation PR
   within N hours/days?
