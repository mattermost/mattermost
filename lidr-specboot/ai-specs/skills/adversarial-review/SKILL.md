---
name: adversarial-review
description: Use when the user requests an adversarial review, red-team review, devil's advocate check, or independent verification pass before archiving an OpenSpec change.
author: LIDR.co
version: 1.0.0
---

# adversarial-review Skill

Act as an **independent adversarial reviewer**: assume gaps, flaws, or unsafe behavior may exist until you have argued against them with evidence.

This skill is intended for the **verification window** of spec-driven development (after implementation, **before** archiving), when the human runs a **different agent or session** than the one that implemented the change.

Do **not** prescribe which agent, model, or IDE to use. That is the human's choice.

## Inputs

- Optional context from user (same style as `show-spec-working`):
  - Direct ticket id in text (for example: `SCRUM-10`)
  - Feature or change name
  - Endpoint(s)
  - Frontend route(s)
  - **Pull request**: URL, or host owner/repo and number (for example: `https://github.com/org/repo/pull/42` or `owner/repo#42`)
- If missing, infer from the current session (active change, branch, or OpenSpec folder).

Resolve scope in this order: explicit ticket or change name → PR when given → current active work.

## Mindset (adversarial review)

Borrowed from common red-team / adversarial practice:

- **Try to break the system**, not only to confirm happy paths.
- **Hunt incorrect assumptions** about data shape, timing, ordering, authz, idempotency, and error handling.
- **Trace cross-boundary and composition risks**: pieces that look fine in isolation but fail together (multi-file, API plus UI, retries plus side effects).
- **Treat the diff as incomplete context**: missing tests, missing negative paths, or spec drift can hide issues.
- **Calibrate depth** to risk: auth, payments, PII, privilege boundaries, and data mutation deserve stricter scrutiny.

## Workflow

### Step 1 — Load the specification side first

1. Identify the OpenSpec change directory and read the relevant artifacts (proposal, design, specs, scenarios, `tasks.md`).
2. Extract **acceptance criteria and explicit non-goals**. List what must be true for "done."
3. Note anything **underspecified** (ambiguous acceptance, missing error cases, missing security constraints).

### Step 2 — Load the implementation side

1. If a **PR** was provided, treat it as the primary implementation surface:
   - Read the PR description and review the full diff scope (not only the default file ordering).
   - Map **files and changes** to spec sections and tasks.
2. If no PR: use `git diff` against the merge base or the branch associated with the change, per project convention.

### Step 3 — Adversarial pass (refute, do not rubber-stamp)

For each acceptance criterion or scenario:

1. State how the implementation **could still fail** while the author believed it passed (wrong input, partial failure, double-submit, stale cache, wrong role, race, empty state, oversized payload).
2. Check **negative and abuse cases** where relevant (validation bypass strings, IDOR-style access patterns, replay, conflict handling).
3. Check **tests and verification artifacts**: do they **prove** the criterion, or only the happy path?
4. Record **spec vs code mismatches** (spec says X, code does Y) as first-class findings.

### Step 4 — Severity and recommendations

Classify each finding:

- **Blocker**: incorrect behavior, security/privacy issue, or spec violation that should stop archive.
- **Major**: likely bug or significant gap; fix or spec update required before archive.
- **Minor**: clarity, maintainability, or low-risk gap; can follow up.
- **Question / assumption**: needs human or author confirmation.

For each finding, state whether the fix belongs in **code**, **tests**, **OpenSpec artifacts** (scenarios, specs, tasks), or **documentation**.

### Step 5 — Verdict

End with a clear verdict:

- **PASS (adversarial)**: no blockers or majors; minors listed optionally.
- **PASS WITH GAPS**: minors only but tracked.
- **FAIL**: at least one blocker or major until addressed.

## Output format

Use this structure in chat:

```markdown
## Adversarial review

**Scope**: <ticket / change / PR>
**Sources**: <list spec paths + PR or diff reference>

### Spec and task alignment
- ...

### Findings

| Severity | Area | Finding | Evidence | Suggested fix (code / spec / tests) |
|----------|------|---------|----------|--------------------------------------|
| Blocker / Major / Minor | | | | |

### Verdict
PASS | PASS WITH GAPS | FAIL

### Recommended next steps (before archive)
- ...
```

## Guardrails

- **Do not** praise implementation to "balance" criticism unless a strength **directly mitigates a documented risk**.
- **Do not** skip reading OpenSpec artifacts when they exist in the repo.
- If you cannot access the PR or diff, say so and list exactly what is needed to continue.

## Completion

Always end with the verdict and whether archiving is **advisable** in the current state.
