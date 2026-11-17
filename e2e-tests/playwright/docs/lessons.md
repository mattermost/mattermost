# Lessons from master failures

This file is the single source of truth for every L- lesson: its text, source
and enforcement. `AGENTS.md`, "Lessons from master failures", carries only the
ones lint can't check, and the E2E Autofix automation reads this file instead of
keeping its own copy. It also covers how `npm run lint:lessons` works and how a
lesson is added, updated or retired.

## Lessons

| Lesson | Rule                                                                                                                                                                                                                                | Enforced by                                               |
| ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| L-001  | Specs never build locators (`page.locator`, `getByRole`, `getByTestId`, ...): add or reuse a member of a page or component object in `lib`.                                                                                         | lint, report-only                                         |
| L-002  | No XPath. In page objects prefer `getByRole` with an accessible name, then label or text, then `getByTestId`; CSS class chains only when nothing else works.                                                                        | lint blocking (XPath); review (locator priority)          |
| L-003  | Fix or report a product bug; never work around it in the test, for example with `force: true`. Find what intercepts the click.                                                                                                      | lint blocking (`force: true`); review                     |
| L-004  | Fix a defect that several specs share once, in a shared helper in `lib`, and use it in every spec that has it.                                                                                                                      | review                                                    |
| L-005  | A product fix that needs new goroutines, timeouts, locks or APIs is not small: report it to the owning PR instead of bundling it with a test change.                                                                                | review                                                    |
| L-006  | Each test restores only `getOnPremServerConfigPatch()`: a config setting a spec changes that isn't in it leaks into later specs, so add it there. `MM_*` env is reset per spec file; data has no reset.                             | review                                                    |
| L-007  | No `waitForTimeout`. `isVisible()` doesn't wait: don't `.catch()` it and don't branch on it; use web-first assertions (`toBeVisible()`, `toBeHidden()`); for an optional element, wait for the state that decides whether it shows. | lint blocking, except a result stored in a variable first |
| L-008  | A fix shows a failing run before and a passing run after. A server-log signal alone earns a report, not a fix, unless it is a small product fix whose new unit test fails before and passes after.                                  | review                                                    |
| L-009  | A server that silently degrades (a fallback, a swallowed error) is a product bug to report, not something for the test to wait out.                                                                                                 | review                                                    |
| L-010  | Tests and page objects take one path and fail fast: never branch on what the page shows; make the state known (set it up or wait for it).                                                                                           | lint, report-only                                         |

## Sources

| Lesson       | Source                                                                                                                                                                                                                 |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| L-001, L-002 | #39372, review by saturninoabril                                                                                                                                                                                       |
| L-003        | #39372: matthewbirtch's review traced a forced click to a global `label span { pointer-events: none }` in `_mobile.scss`                                                                                               |
| L-004        | #38986                                                                                                                                                                                                                 |
| L-005        | #39376: the reviewer reverted the added timeouts                                                                                                                                                                       |
| L-006        | Leaks fixed: `CollapsedThreads` (#39377), `PrivacySettings.ShowFullName`/`ShowEmailAddress` (#39497), open-invite teams (#39864). In review: `ElasticsearchSettings.Enable*` (#39871), leftover ABAC policies (#39875) |
| L-007        | #39372                                                                                                                                                                                                                 |
| L-008        | #39376                                                                                                                                                                                                                 |
| L-009        | Counter-example: #39445 made the search specs wait for an engine answer, because on an engine error search falls back to the database (the cause is logged at warn) and the response only differs by `matches: null`   |
| L-010        | #39982, review by praid3n: branching on page state hides failures, so tests and page objects should fail fast. Lint (report-only for now); `AGENTS.md` shows a bad and a good example                                  |

## Product lessons

Lessons about product code live next to it: P-001 to P-003 in
`webapp/AGENTS.md`, P-004 and P-005 in `server/AGENTS.md`. They have no lint.

| Lesson | Source                                                                                                                                                                                                                                                                   |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| P-001  | #39806: Enter right after the editor's 100 ms debounce sent stale text. #39452 had added a flush before submit that missed the case where the timer had just fired; the fix reports the debounced update inside `flushSync`                                              |
| P-002  | #39807: a `useEffect` in `RewritePromptInput` (added by #38007) wrote a lagging `value` prop into the uncontrolled input and dropped typed characters; the fix keeps the input uncontrolled and tracks the values it has already reported                                |
| P-003  | #39372: matthewbirtch's review traced forced clicks on Compass switches to the global `label { span { pointer-events: none } }` in `_mobile.scss`. Not user-facing, but it breaks Playwright clicks                                                                      |
| P-004  | #39376: `PermanentDeleteFlaggedPost` posted two first replies from two goroutines and the second `INSERT INTO Threads` hit the unique key; the fix makes the removal notice wait for the report goroutine. The store race in `updateThreadsFromPosts` is not fixed there |
| P-005  | #39445: search falls back to the database on an engine error (the cause is logged at warn), and the response only differs by `matches: null`, so a spec could pass without the engine answering                                                                          |

## Lint ratchet

The lint-checked rules (see "Enforced by" above) live in
`eslint-rules/lessons.mjs`. Many existing files break them, so they are not part
of `npm run lint`. Instead, `npm run lint:lessons` (`script/lint-lessons-ratchet.mjs`, also run
by `npm run check` and in CI) lints every `.ts` file a change touches twice, as
it is now and as it was on the base, and fails if any lesson rule fires more
often now. Files nobody touches are never checked.

- When it fails, it lists every hit of that rule in the file, old and new.
  Remove the one you added; you don't have to fix the old ones.
- Rules in `REPORT_ONLY_RULES` (`eslint-rules/lessons.mjs`) are listed the
  same way but don't fail yet. L-001 and L-010 start there; each becomes
  blocking as described in "Promoting a report-only rule" below.
- Renaming or moving a file compares it with its old path, so a pure move
  passes.
- The base is the merge base of `HEAD` and `origin/master`. Set `LESSONS_BASE`
  to compare against another commit; CI sets it to the PR's base.
- The rules are best-effort pattern checks. They don't see through variables
  or constants (`const visible = await x.isVisible(); if (visible)`, or
  `locator(SELECTOR)` where `SELECTOR` is a constant), so those forms are left
  to review.

## Promoting a report-only rule

A rule leaves `REPORT_ONLY_RULES` when no open PR and no file a change touches
would fail on it, and the team has been told. Whoever adds a rule to
`REPORT_ONLY_RULES` also opens a ticket and names an owner in the PR, so it
doesn't stay report-only forever. L-010 blocks once the open PRs that still
branch on page state (#39913, #34607) are cleaned up.

## Adding a lesson

A lesson about product code gets a `P-` id and goes in `webapp/AGENTS.md` or
`server/AGENTS.md`; keep it to one or two lines, because agents load those files
on every task there.

Add a lesson when a human review rejects the same mistake in two or more PRs,
or when it caused a master failure. Give it the next id and one rule in a
sentence or two in the Lessons table, and add its source to the Sources table.
It goes in `AGENTS.md` too only when lint can't catch it. If a lint rule can
catch it, add it to `lessonsConfig` in `eslint-rules/lessons.mjs` (a new rule in
that file, or a `playwright/` rule) in the same PR, with cases in
`eslint-rules/lessons.test.mjs` (`npm run test:lint-rules`). A rule that many open PRs would break can start in
`REPORT_ONLY_RULES`. When a lesson's rule has no violations left anywhere, move
it into `eslint.config.mjs` as a plain error. The E2E Autofix weekly
retrospective opens such PRs from reviewer feedback; a human merging the PR is
what makes the lesson binding.

## Updating or retiring a lesson

A lesson with no recent violations is working: keep it. Change one only when
its premise changed:

- **Update** it when a file, helper or setting it names was renamed or moved.
- **Retire** it when what it guards against can no longer happen: the helper,
  API or behaviour is gone, or a lint rule or type now makes the mistake
  impossible and the lesson says nothing the rule's message doesn't.
- **Merge** two lessons that say the same thing into the older id.

Delete a retired lesson in the same PR that explains why, and never reuse its
id, because PRs cite them. Keep `AGENTS.md` short enough to read before every
change: past 15 lessons, merge or retire before adding.
