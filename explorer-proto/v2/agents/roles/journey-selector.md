# Role: journey-selector

Orchestrator task role: `charter-proposer` (stage 4, `select`). Orchestrator prompt: `explorer-proto/v2/orchestrator/prompts/select.md`.

## Purpose

Propose one to five user journeys worth testing for one feature, as `explorer-charter/v2` charters, each with a coverage candidate. Code, not you, checks every proposal: schema, leakage and the duplicate gate run regardless of what you say.

## Inputs

- `explorer-proto/v2/orchestrator/features/<id>.json`: general action rules, the discovery budget, the oracle classes (schema `explorer-feature/v1`). It holds no route.
- `0-target/target.json`: the build under test.
- `1-index/index-summary.json` and `1-index/data/tests.jsonl`: the coverage index, one existing test per line.
- `3-triage/triage-summary.json` when the explore stage produced findings.
- `explorer-proto/v2/schemas/README.md` (charter) and `explorer-proto/v2/index/README.md` ("Candidate file").

## Outputs

`4-select/agent-result.json`, schema `agent#select` (`explorer-select-result/v1`): `proposals` with 1 to 5 items, each `{charter, candidate}`.

- `charter`: copy `start`, `action_rules`, `budget` and `oracles` from the feature unless you can say why to narrow them. One first-person goal sentence and the consequence if it breaks. `goal_terms`, `dedupe.key` equal to the `charter_id`, and the five-rule `leakage` section exactly as the schema requires.
- `candidate`: the words a user sees on screen (title, actors, setup, goal terms, checkpoints, UI labels). Code uses it to find existing tests that already cover your proposal.

## Allowed tools

Read a file, list a directory, search repository text (read-only), and write the one result file. Nothing else.

## Forbidden actions

- A route, an ordered step, a numbered list, "then click", "first ... next", an arrow chain, or a control to click in a charter.
- A key the charter schema does not define, or a key that names a step, route, sequence, script or procedure.
- A control label that belongs to another session's charter.
- An origin, a port, a token, a password, or a 26-character id.
- A proposal that an existing test already covers. Search first and propose something else.

## Checklist

- [ ] Search the index and the e2e directories for the distinctive words of each idea before you write it down.
- [ ] Read `origin` on index records: `session` and `emitted` records are earlier explorer output. Do not mine them for routes.
- [ ] Name actor, trigger and asserted outcome for each proposal in the candidate, and check they are not those of a ranked test.
- [ ] Write the goal as intent. Remove words that are near-verbatim names of controls you may have read in the index.
- [ ] Give `goal_terms` as phrases a user would say. Keep `dedupe.key` equal to the `charter_id`.
- [ ] Include all five leakage rules, and no exemption you cannot justify.
- [ ] Prefer proposals whose checkpoints are outcomes (a state, a count, a persisted value) over proposals about a control.
- [ ] If findings were triaged, do not propose a charter that only re-tests a confirmed bug; say so instead.
- [ ] Re-read each charter once for step words and numbered items.

## Failure modes seen in earlier pilots

- A canned leaky proposal ("click the channel menu then click the first item") is rejected by the leakage gate. See `explorer-proto/v2/orchestrator/lib/stub_agent.mjs` (scenario `leaky`).
- A planted duplicate (F4, the bookmark open flow already covered by `MM-T5611`) must be rejected, so propose something an existing test does not cover. See `explorer-proto/v2/bakeoff/PREREGISTRATION.md` (section 3, F4).
- A charter or notes that describe the route make discovery trivial; the session charters carried an allowlist of controls. See `explorer-proto/v2/bakeoff/PREREGISTRATION.md` (section 11).
- A goal that shares words with the control text helps the search without proving the journey is discoverable. See `explorer-proto/sessions/auto-follow/QA-NOTES.md` (section 9).
- The index has low recall, so "no close match" does not mean "nobody tests this". See `explorer-proto/v2/index/eval/RESULTS.md`.
- The extractor output does not match the coverage index schema field for field, so check fields by name in the real records. See `explorer-proto/v2/orchestrator/README.md` (Known gaps).

## What you must NOT see

- QA notes (`QA-NOTES.md`), the session charters and traces, `explorer-proto/scenarios.json`, `explorer-proto/coverage.md` and anything under `explorer-proto/generated/` or `explorer-proto/sessions/`: they hold routes and control names of earlier pilots.
- A sealed or reference route for any journey.
- `explorer-proto/v2/bakeoff/` (the pre-registered rules, expected dispositions, deny list and inputs).
- `MM_LICENSE` or any credential.

The wrapper refuses a task whose inputs match these (`roles/index.json`).
