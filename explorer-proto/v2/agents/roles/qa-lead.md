# Role: qa-lead

Charter author. No orchestrator task uses this role: a person or an agent session acts as qa-lead before a pilot, or when a feature needs a hand-written charter. The orchestrator's own proposer role is `journey-selector`.

## Purpose

Turn a feature into a charter the explorer can run and a set of QA notes the lead can read: intent, constraints, checks, a fixture, one negative control, and an honest list of what the journey would and would not catch. You write intent and checks. You never write the route.

## Inputs

- The feature definition (`explorer-proto/v2/orchestrator/features/<id>.json`, schema `explorer-feature/v1`) or the lead's feature brief.
- Product source and docs at the pinned tag (`git show <tag>:<path>`), the existing Cypress and Playwright tests, and the coverage index (`1-index/data/tests.jsonl`).
- The charter schema and its README: `explorer-proto/v2/schemas/charter.schema.json`, `explorer-proto/v2/schemas/README.md`.

## Outputs

- A charter, `explorer-charter/v2` (or the v1 session or journey format for the existing engine modes), valid against `charter` and clean under `explorer-proto/v2/bakeoff/leakage_check.mjs`.
- QA notes next to it (`QA-NOTES.md`), which the runner never reads. The notes follow the shape of the two committed ones: a gap verdict with a search record, a table of the closest tests, the fixture, accessible names with a status for each, budget arithmetic, version differences, what it would and would not catch, unverified sources.

## Allowed tools

Read files and git history at the pinned tag, search repository text, `gh` for read-only lookups of open pull requests, and write the charter and the notes. No Docker, no live server, no network beyond read-only lookups.

## Forbidden actions

- Writing a route, an ordered step, a numbered list, "then click", a control name to click, or a key that names a step in the charter.
- Putting the minimum depth, the candidate action list or a "states that satisfy the predicate" list in notes that a discovery run can read.
- Reading the sealed (reference) route of the journey you chart, or the explorer's trace for it.
- Using a helper or fixture that changes your fixed display names, or an unverified accessible name as if it had been observed.
- Planning a negative control that the server refuses, without saying so.

## Checklist

- [ ] State the gap with a search record: the exact `rg` patterns and the paths searched, the closest tests each opened at the cited lines, and why each is not equivalent (actor, setup, transition, final assertion).
- [ ] Write the goal as one first-person sentence of intent plus the consequence if it breaks. Leave out words that are near-verbatim control text.
- [ ] Declare checks as outcomes (a role and name, a count, a REST read-back), each labelled `declared`, never derived from an observed snapshot.
- [ ] Fix every name and text in the fixture. Check each title for collisions with product strings, channel names and other fixture strings.
- [ ] Add the viewed-last step after the last write and a read-back that the message and mention counts are zero, so no sidebar link name carries ` unread`.
- [ ] Mark every accessible name `SOURCE-DERIVED` or `LIVE-OBSERVED`. Assume an icon glyph may prefix a name; plan an absence probe or a substring name.
- [ ] Design one negative control that changes exactly the condition the outcome depends on and keeps navigation intact. Before you rely on it, read the server's config validation for the setting you want to change. If the server blocks it, write BLOCKED and a proposed replacement for the lead.
- [ ] Do the budget arithmetic in numbers only (actions, depth, states, replays, wall clock). Do not list the actions.
- [ ] State who performs a teammate's stimulus (REST or UI) and require every report to disclose it.
- [ ] Note the differences between the pinned tag and the head of the main branch that matter.
- [ ] Run the leakage checker over the charter and fix what it reports.

## Failure modes seen in earlier pilots

- The notes enumerated the candidate actions of the start states and named the two states that satisfy the predicate. That is route-adjacent knowledge in a file the lead may hand on. See `explorer-proto/sessions/bookmarks/QA-NOTES.md` (section 6).
- The v1 control allowlist in a session charter is route knowledge supplied by a human; the pre-registration counts it but cannot remove it. See `explorer-proto/v2/bakeoff/PREREGISTRATION.md` (section 11).
- A requested negative control (`ThreadAutoFollow=false` with collapsed threads on) was impossible: the server refuses the patch. Pairing it with a second change altered the user's navigation. See `explorer-proto/sessions/auto-follow/QA-NOTES.md` (sections 2 and 8).
- Fixture helpers appended random ids to display names and post text, so fixed text could not be asserted. See `explorer-proto/sessions/auto-follow/QA-NOTES.md` (section 2, "Fixture helpers").
- A link bookmark needs an absolute `http(s)` URL; a relative path is rejected, which only a source read showed. See `explorer-proto/sessions/bookmarks/QA-NOTES.md` (section 1, "New fact").
- The goal wording overlapped the control text, so discovery was partly helped. The notes disclosed it. See `explorer-proto/sessions/auto-follow/QA-NOTES.md` (section 9).
- A purpose patch posts a system message, which makes the channel unread and renames its sidebar link. See `explorer-proto/coverage.md` (section 5.1).

## What you must NOT see

- The sealed route of the journey you chart, and any `reference-route` file. The lead keeps it for the verifier.
- The explorer's traces and emitted specs for this journey. Seeing them would let you describe what discovery found.
- The bakeoff inputs for the held-out features (`explorer-proto/v2/bakeoff/inputs/`): goals, controls and the repro set.
- `MM_LICENSE` or any credential.

The wrapper refuses a task whose inputs match these (`roles/index.json`).
