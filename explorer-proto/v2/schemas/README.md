# Explorer v2 artifact schemas

JSON Schema draft-07 contracts for the artifacts of the program-driven pipeline
(`target -> index -> explore -> triage -> select -> discover -> emit -> verify -> promote -> lessons`) and for the bakeoff.
Agents plan and judge; deterministic code acts, measures and gates. Every artifact that a gate reads has a schema, and
every verdict points at evidence by reference.

## Files

| Schema | Artifact | Key rules |
| --- | --- | --- |
| `target` | The exact build under test | `kind` release or main; release `ref` is a `vX.Y.Z` tag, main `ref` is `master` or `main`; image ref plus digest; `licence_check` is `PASS` or `FAIL` and nothing else. |
| `coverage-index` | Existing Cypress and Playwright tests, structurally extracted | Per test: suite, file, line, title, tags and test ids, actors, setup calls, ordered action labels and locators, assertion targets as `file:line` (helper-resolved ones carry the helper), a structural fingerprint, and `source_status` `extracted` or `partial` (partial needs reasons). |
| `finding` | One oracle observation | Oracle class, severity candidate, sanitized state path, sanitized evidence text, reproduction count, `candidate`, `confirmed` or `rejected` (confirmed needs 2 or more reproductions), link to a trace. |
| `charter` | Intent, constraints and checks | See [Charter](#charter). |
| `trace` | What an exploration or discovery run observed | States, transitions, budget used, guard result, outcome. Paths are sanitized. |
| `verdict` | Per-gate pass, fail or blocked | Every gate carries at least one evidence reference. `overall` must agree with the gates. A duplicate rejection names the covering test. |
| `lesson` | A proposal only | Observation, evidence, proposed check, `proposed`, `approved` or `rejected`, an approver once decided. `applied` is always `false`. |
| `bakeoff-result` | One version's results on one target | Sections for each metric of `bakeoff/PREREGISTRATION.md`. Version A is pinned to the frozen v1 commit and cannot hold the v2-only bug-oracle sections. |
| `bakeoff-rules` | The pre-registered rules (`bakeoff/rules.json`) | Discovery budget, expected outcome per held-out feature, decision thresholds. |
| `repro-set` | The known-bug reproduction set, provided later by the lead | `id`, `summary`, `expected_oracle_class`; optional `state_path` and `reproduces` (default true). |
| `common` | Shared definitions | Hashes, ids, sanitized path and evidence text, evidence references (an identifier or repo path, never prose), the oracle, outcome and gate vocabularies. |

`shared.mjs` holds the constants that the schemas and the scripts must agree on (oracle classes, outcomes, gate names, the
forbidden key words, the unsafe-text pattern). `bakeoff/selftest.mjs` fails if a schema file drifts from them.

## Validate

```bash
node explorer-proto/v2/schemas/validate.mjs <schema> <file>   # e.g. validate.mjs target target.json
```

Prints `OK <file>` or `FAIL <file>` plus the first five errors (JSON path and rule only, never the offending data). Exit
0 valid, 1 invalid, 2 usage or load error. The validator is Ajv 8 loaded from `e2e-tests/playwright/node_modules/ajv`
(already installed with the Playwright workspace; nothing is installed or downloaded). It runs in strict mode with
`strictTypes` and `strictRequired` off, because the conditional (`if`/`then`) clauses name properties that the parent
declares; `bakeoff/selftest.mjs` checks every `required` name is defined in its file instead.

`examples/` holds one or more valid and several deliberately broken examples per schema, listed in
`examples/manifest.json` with the error text each broken example must produce. The examples use synthetic ids and a
feature unrelated to the bakeoff's held-out features.

## Charter

`charter.schema.json` unifies `explorer-session-charter/v1` and `explorer-journey-charter/v1` with the new
`explorer-charter/v2`, selected by `schema`. Fields of the two v1 formats are optional sections of one flat object, so the
existing `sessions/bookmarks/charter.json` validates unchanged. Conditions per version:

- `explorer-charter/v2` requires `charter_id`, `goal`, `lane`, `start`, `budget`, `action_rules` and `leakage`, and forbids `allowed_actions` (a v2 charter states policy, not named controls).
- `explorer-session-charter/v1` and `explorer-journey-charter/v1` keep their original required sections and cannot carry `leakage`.

**No field can hold ordered steps.** All objects are closed (`additionalProperties: false`) except the fixture and
procedure sections, which are open but whose property names must not contain a forbidden word (`step`, `route`,
`sequence`, `walkthrough`, `script`, `procedure`, `recipe`, `playbook`, `itinerary`, `waypoint`, `breadcrumb`, `reachable`,
`click`, `navigate`; matched as whole snake_case, kebab-case or camelCase tokens). The v1 `events[].requests` and
`events[].ordering` (an ordered REST request list) are therefore not defined: an event names a primitive `action` such as
`post_thread` plus `params`, and deterministic code performs it.

**The `leakage` section** is a list of rule kinds the checker applies, plus the subtrees exempt from the prose rules.
Every charter must list all five kinds (`contains` clauses enforce it):

| Kind | Meaning |
| --- | --- |
| `ordered_phrase` | Ordered-step wording in prose: "then click", "click X then Y", "first/next/finally <verb>", "step 2", arrow chains. Optional `patterns` add regular expressions. |
| `numbered_steps` | Numbered list items inside a string. |
| `deny_labels` | Control labels of OTHER sessions (`deny_list`, a repo path to `bakeoff/deny_labels.json`). A charter's own `allowed_actions` labels never count against it. |
| `unknown_key` | Any key the schema does not define. |
| `forbidden_key` | Any key that names a route or step, and digit-only keys. |

`exempt_paths` may only be chosen from a fixed list (`fixture`, `fixture_setup`, `negative_controls`, `target_release`,
`dedupe`, `qualifies_reason`, `**.source`, `**.why`, `**.note`). The checker is `bakeoff/leakage_check.mjs`.
