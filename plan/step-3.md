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
- **Weblate write-freeze before hard gates** (decided): freeze first;
  AI-generated translations supersede any Weblate content thereafter.

## Concrete tasks

### 3.1 Freeze Weblate writes for target repos

- [ ] Disable or pause Weblate → GitHub updates for surfaces about to
  enforce author-submitted locale files (coordinate with step 4).
- [ ] Do not rely on "regen is cheap" to absorb clobbers of reviewed
  glossary-constrained strings.

### 3.2 Author workflow (human-facing)

Decided policy: **strict same-PR** — translations for all 22 locales land
in the same PR as the `en.json` change; no follow-up-PR pattern. **No
human review of locale diffs** — CI gates (parity, syntax) are the sole
check on translated hunks; reviewers focus on the English source string
only.

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

### 3.5 Identical-to-source: no gate (decided)

**Deleted from scope.** An identical-to-English heuristic was proposed
(thresholds + allowlists, `en-AU` exemption) because key-parity and
structural-equality gates cannot see copy-pasted English. Owner decided
to drop it entirely to trim scope: the existing backlog (Playbooks
`zh_Hant`) is fixed once by the step-2 bulk pass, and no ongoing gate
guards against recurrence.

**Accepted risk**: an author (or a misbehaving generator) filling locale
files with the English source passes all CI gates silently; the step-5
correction workflow is the recourse. Revisit only if this recurs in
practice.

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
| Authors own 22 locales per string PR (#2) | **Resolved — strict same-PR** | DX concern raised; owner confirmed strict same-PR with no locale-diff human review (CI is the gate), which removes the review-load objection. |
| No CI translator | **Accept + guardrails** | Still need a local/scripted generator — "just use AI" is not a workflow. |
| `formatjs verify --extra-keys` (#13) | **Reject as stated** | Flag does not exist on pinned CLIs; implement custom extra-key check. |
| Plugin FormatJS parity | **Reopen** | Older `@formatjs/cli` pins may not expose `verify`. |
| Identical-to-`en` hard fail | **Resolved — gate deleted** | Threshold design was debated (`en-AU` ~84–92% identical is normal); owner removed the gate from scope entirely. |
| mmgotool one release path | **Reopen** | Platform vendored vs Calls `@latest` vs Playbooks utilities pin. |
| Weblate overlap OK (#14) | **Resolved — freeze first** | Owner confirmed: freeze Weblate writes first; AI translations supersede Weblate content from then on. |

## Risks

- Locale hunks are unreviewed by design — quality rests entirely on the
  generator and CI gates; a gap in the gates ships silently.
- **Accepted (decided)**: English copy-paste into locale files passes all
  gates — no identical-copy check exists; corrections (step 5) are the
  recourse.
- Plugins lag on tool upgrades → uneven enforcement.

## Acceptance criteria

- [ ] Documented author generator works on a sample string-change PR.
- [ ] Mobile `CLAUDE.md` (and equivalents) no longer forbid locale edits.
- [ ] CI fails on missing keys for gated repos.
- [ ] CI runs structural/template checks appropriate to JS/Go.
- [ ] Weblate writes frozen for gated locale paths before gates enable.

## Open questions

1. Is `en-AU` required to diverge, or mostly inherit `en` with a small
   overlay? (With the identical-copy gate deleted, this is now purely a
   content policy question — no CI implications.)
2. ~~Who reviews 22-locale AI diffs in product PRs?~~ **Resolved: no
   human reviewers — CI gates are the sole check on locale diffs.**
3. ~~Hard gate start date vs Weblate freeze date?~~ **Resolved: freeze
   first; AI translations supersede Weblate content.**
4. Canonical `mmgotool` module path going forward?
5. ~~Product PR lands `en` only + follow-up translation PR?~~ **Resolved:
   strict same-PR.**
