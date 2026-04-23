# Phase 7: Ship

**Goal**: Commit, push, create PR.

Principle citation: [rules.md §8](rules.md#8-principle-applications) — this PR should be a point of pride, not a burden for peers.

## Step 7.0: Pre-Ship Verification (MANDATORY)
Final pass of all fast checks before committing. This catches anything that drifted during late-stage edits. Run ALL profile-defined checks (everything except full E2E): auto-format, lint, typecheck, unit tests, i18n extraction, and code generation.

Use top-level build commands only — see [rules.md §1.1](rules.md#11-top-level-build-commands-only). Per-profile commands listed in [profiles.md](profiles.md) under "Pre-Ship Checks".

Attempt budget: 2 ([rules.md §4](rules.md#4-retry--escalation-budgets)). If still failing after 2 attempts, report and proceed with a warning in the PR description.

## Step 7.1: Documentation Check
Before staging, verify documentation is current:

- API changes → API docs / swagger / README updated
- New config options → deployment docs updated
- User-facing changes → changelog entry drafted
- Database migrations → migration notes documented
- If docs are missing, add them before proceeding

## Step 7.1.5: Secret Scan
Before staging, scan changed files for accidental secret inclusion:
- Run `git diff HEAD --name-only` and check for `.env`, `*.key`, `*.pem`, `credentials.*`, `secrets.*`
- Regex scan staged content for patterns: `AWS_SECRET|PRIVATE_KEY|password\s*=|api[_-]?key|token\s*=|-----BEGIN`
- If matches found: **STOP** — report file and line, do NOT stage. Ask user to confirm these are safe or remove them.

## Step 7.2: Stage Files
Stage specific modified files per [rules.md §2](rules.md#2-git-safety) — never `git add -A`. Exclude:
- `.env`, credentials, secrets
- Tracking files (`*.tracking.md`)
- Unrelated changes

## Step 7.3: Commit
Create local commit with conventional format (see [rules.md §2](rules.md#2-git-safety) for format rules and [rules.md §1.3](rules.md#13-no-ai-attribution-in-commits-or-prs) for attribution):
```text
<type>(<scope>): <subject>

<body explaining what/why>

Context: /longshot — <state.json.recap>
```

**If `security.is_security_issue`**: apply [rules.md §3.1](rules.md#31-language-rules-applies-to-all-artifacts) — functional language only. Example: `fix(api): improve input handling in channel member endpoint. See MM-1234` — not `fix: prevent XSS in channel member endpoint`.

**Local commits are acceptable without confirmation.**

## Step 7.4: Confirm Push + PR
**Ask user to confirm** before pushing to remote or creating a PR. Present:
- Commit summary (files changed, insertions/deletions)
- Proposed PR title and body
- Target branch

**If `security.is_security_issue`**: also confirm per [rules.md §3.4](rules.md#34-pr-sanitization):
- PR title does not contain security terminology (present proposed title for explicit approval)
- User has notified or plans to notify the Security team after push

## Step 7.5: Push + PR (after user confirms)
- **PR body template** (fill from pipeline artifacts):
  ```text
  ## Summary
  <1-3 bullet points from spec.md>

  ## Test Plan
  - [ ] Unit tests added/updated (list key test files)
  - [ ] E2E tests added/updated (list spec files)
  - [ ] Regression tests verified (list features checked)

  ## Screenshots
  <Attach screenshots from Phase 4 exploratory testing, if UI changes>

  ## Known Issues
  <List SHOULD_FIX items from Phase 6 review, if any>

  ## Review Notes
  <Highlight non-obvious decisions, migration notes, or areas needing extra scrutiny>
  ```

**If `security.is_security_issue`**: sanitize the PR per [rules.md §3.4](rules.md#34-pr-sanitization). Remind the user to notify the Security team after push.

- Push branch to remote with `-u` flag
- If `PULL_REQUEST_TEMPLATE.md` exists, fill it out
- Create PR via `gh pr create`
- Report PR URL

If `--skip pr` or `gh` unavailable: stop after local commit; report branch + base for manual PR creation ([rules.md §5.3](rules.md#53-cli-tool-fallback)).

Update state.json per [rules.md §1.5](rules.md#15-statejson-update-ritual).

---
