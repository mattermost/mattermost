# Pilot v2 gates (WP-E)

Frozen, human-approved verification gates for the program-driven pipeline: strict, deterministic, unit-tested against
deliberately bad inputs. Every gate is a standalone ES module (`export const gate = {id, run(ctx)}`) **and** a CLI, so
the orchestrator can use either. Node 24, built-ins only, no network (REST actions in `mutation_control` are limited to
loopback). Ajv comes from `e2e-tests/playwright/node_modules` through `../schemas/validator.mjs`; the TypeScript compiler
API comes from the same workspace. Nothing is installed or downloaded. Output holds no timestamps.

```bash
node explorer-proto/v2/gates/selftest.mjs          # every unit test; exit 0 only if all pass
node explorer-proto/v2/gates/selftest.mjs --quiet  # failures and summary only
node explorer-proto/v2/gates/replay_judge.mjs --selftest
```

Changes to anything here follow [POLICY-CHANGE.md](POLICY-CHANGE.md).

## Gate catalog

| Gate id (`gate.id`)    | Module / CLI                                    | Enforces                                                                                                                                                                                                                                                   | Earlier lesson | Known weaknesses                                                                                                                                                                                                                                                                                                                                                                                                                        |
| ---------------------- | ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `static_spec`          | `static_spec_check.mjs`                         | 26 token/AST rules over an emitted spec (table below)                                                                                                                                                                                                      | 1, 2, 3, 7     | Heuristic. Follows only same-file `const` locators; cannot see inside page-object methods or helpers; has no live accessible names, so it cannot know a name carries an icon glyph. Markers (`soft-ok`, `absence-verified`, `unread-ok`, `random-ok`) are accepted on trust unless `--probe-id` lists the valid probe ids. Not charter-aware: the random-data rule applies to every spec.                                               |
| `replay_judge`         | `replay_judge.mjs`                              | Strict judgement of Playwright JSON reports against an expectation (`pass` or `control-fail`)                                                                                                                                                              | 2, 4, 7        | Trusts the report file: it cannot tell a fabricated report from a real one. The failing call comes from the report's code frame, or, as with Playwright 1.62.1 whose JSON error holds only `message` and `location`, from the source line at `location`, so the spec file must still be readable at that path and multi-line statements are compared by their first line. Test titles match by equality or by `<id> ` / `<id>:` prefix. |
| `stability_20`         | `stability_gate.mjs`                            | N (default 20) fresh-fixture reports: N/N clean passes, retries 0, 0 flaky, skipped, timed out; no `disposed`, `Network guard violations`, `route handler error`, `Test timeout` in reports or the supplied logs; optional trace determinism across stacks | 2, 6, 7        | Cannot prove the fixtures were fresh: it only rejects copied reports (identical content or `startTime`) and inconsistent test sets. Log greps only cover the logs the caller supplies. 20/20 still allows a flake rate up to 13.9% at 95% confidence (`--estimate-flake`).                                                                                                                                                              |
| `mutation_control`     | `mutation_control.mjs`                          | Runner-agnostic control plan with explicit states; a blocked control is `control blocked`, never a pass                                                                                                                                                    | 4, 7           | The read-back expectations are only as good as the plan author's. One control per plan; no lock against a concurrent writer. The spec run itself is the caller's.                                                                                                                                                                                                                                                                       |
| `promotion`            | `promote_decision.mjs`, `promotion_policy.json` | `promote_pr`, `quarantine` or `reject` from gate results only                                                                                                                                                                                              | 7              | Without `--gate-result` it trusts the verdict's gate results, which an agent may have written. Always pass the raw gate outputs. Un-quarantine scheduling is a policy value only.                                                                                                                                                                                                                                                       |
| `policy_pin`           | `policy_hash.mjs`                               | sha256 of every gate module, fixture and the policy; detects changes after a freeze                                                                                                                                                                        | all            | Detects, does not prevent. Approval records are only as trustworthy as who can commit `approvals.json`.                                                                                                                                                                                                                                                                                                                                 |
| `lessons_guard`        | `lessons_guard.mjs`                             | A lesson that touches gates, the policy, the bakeoff or the schemas needs a named human `approver`                                                                                                                                                         | all            | Human-ness is judged from the handle (non-empty, lowercase handle, not an automation word). A coordinated human account would pass. The prose scan is a regex.                                                                                                                                                                                                                                                                          |
| `containment_evidence` | `containment_evidence.mjs`                      | Second localhost origin rejected in exploration and replay, WebSocket other origin closed, service workers blocked, race count; evidence for the spec-as-run                                                                                               | 7              | Cannot verify provenance. It binds the spec by sha256 when `--spec-file` is given, but the attestation that a run produced the numbers belongs to the producer.                                                                                                                                                                                                                                                                         |

Lesson numbers are those of the brief: (1) absence assertions on exact names can pass vacuously when the live name has an
icon-glyph prefix; (2) many `expect.soft` at the 10 s expect timeout exceed the 60 s test timeout and give a
location-less timeout; (3) a new post adds an ` unread` suffix to sidebar link names; (4) server config validation can
block a planned negative control, which must be reported BLOCKED; (5) a charter or QA notes that describe the route make
discovery trivial; (6) snapshot normalisation must be stable across fresh stacks; (7) a skip, setup failure,
location-less timeout, closed page or guard error never counts as a pass.

Lesson 5 is enforced by the existing `leakage` gate (`../bakeoff/leakage_check.mjs`), which the policy requires; this
directory only requires that it passed. Lesson 6 is covered by the trace-determinism option of `stability_20`
(`--trace a.json --trace b.json` from two freshly seeded stacks).

### `static_spec` rules

| Rule                      | Rejects                                                                                                                                                                                                                                       | Lesson |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| `parse-error`, `no-tests` | A spec that does not parse or declares no `test(...)`                                                                                                                                                                                         | 7      |
| `sleep-wait`              | `waitForTimeout`, `setTimeout`, `setInterval`, `sleep`, `delay`, `wait(<number>)` (also through `obj['name']`)                                                                                                                                | 2      |
| `soft-declared`           | `expect.soft` without a `// soft-ok: <reason>` marker                                                                                                                                                                                         | 2, 7   |
| `soft-consecutive`        | More than 3 (configurable) consecutive soft assertions                                                                                                                                                                                        | 2      |
| `timeout-risk`            | Worst case `sum(soft timeouts) + max(hard timeout)` above the test timeout. Timeouts come from the repo Playwright config (60 s test, 10 s expect), `{timeout: n}` on an assertion and `test.setTimeout(n)`; `timeout: 0` counts as unbounded | 2      |
| `css-xpath-locator`       | `.locator(...)`, `frameLocator`, `$`, `$$`, `$eval`, `querySelector(All)`. Only `getByRole` and `getByTestId`                                                                                                                                 |        |
| `get-by-text-presence`    | `getByText` with a non-exact string in a presence assertion                                                                                                                                                                                   |        |
| `regex-presence`          | A regex name or text in a presence assertion                                                                                                                                                                                                  |        |
| `presence-name-not-exact` | A string name (role, label, placeholder, alt, title) without `exact: true` in a presence assertion                                                                                                                                            |        |
| `action-not-role`         | A UI action through `getByTestId`, `getByText`, `getByLabel`, `getByPlaceholder`, `locator`... (the locator closest to the action must be `getByRole`)                                                                                        |        |
| `action-name-not-exact`   | A UI action through a role whose name is not `exact: true`                                                                                                                                                                                    |        |
| `absence-exact-name`      | An absence assertion (`toHaveCount(0)`, `toBeHidden`, `not.toBeVisible`...) on an exact name without `// absence-verified: <probe id>`                                                                                                        | 1      |
| `unread-suffix`           | In a spec that creates posts, an exact `link` name that does not end in ` unread` and has no `// unread-ok: <reason>`                                                                                                                         | 3      |
| `skip-fixme`              | `test.skip`, `test.fixme` (incl. `describe`), `skipIf*` such as `pw.skipIfNoLicense()`                                                                                                                                                        | 7      |
| `test-only`               | `test.only`                                                                                                                                                                                                                                   |        |
| `retries-config`          | Any `retries` property inside the spec                                                                                                                                                                                                        | 7      |
| `describe-parallel`       | `test.describe.configure({mode: 'parallel'})`                                                                                                                                                                                                 |        |
| `raw-url`                 | An origin, loopback host, IP address in a string, template or comment                                                                                                                                                                         |        |
| `server-id`               | A 26-character id (lowercase letters and digits, at least one digit) in a string or comment                                                                                                                                                   |        |
| `password-literal`        | A non-empty literal under a password, token, secret, key or authorization name; `Bearer`, `MMAUTHTOKEN`, `MMCSRF`, `password:` text                                                                                                           |        |
| `random-data`             | `pw.random.*`, `Math.random`, `Date.now`, `uuid`, `faker`, `pw.initSetup` without `// random-ok: <reason>`: charters fix the text                                                                                                             |        |
| `missing-objective`       | A test without an `@objective` comment                                                                                                                                                                                                        |        |
| `no-trailing-assertion`   | A test with no assertion after its last UI action (`click`, `fill`, `goto`...)                                                                                                                                                                | 7      |
| `label-missing`           | An assertion line without a trailing `// declared (...)` or `// smoke: ...` comment                                                                                                                                                           |        |
| `unawaited-assertion`     | A web-first assertion that is not awaited, so it can never fail the test                                                                                                                                                                      | 7      |

Presence versus absence: `toBeVisible`, `toHaveCount(n > 0)`, `toContainText` and similar are presence; `toHaveCount(0)`,
`toBeHidden`, `toBeDetached` and `not.toBeVisible` are absence. For absence, a regex or a non-exact string (a substring
match) is the correct form and needs no marker, because it cannot pass vacuously on a glyph-prefixed name.

#### How `expect.soft` is treated (decision)

The earlier pilot specs used `expect.soft` for seed-bound text so that a negative-control seed reports every failing
declared string. That is a documented choice and the gate does not silently allow it or forbid it:

- every `expect.soft` needs a `// soft-ok: <reason>` marker on its line (`soft-declared`);
- at most 3 soft assertions in a row (`soft-consecutive`, `--max-consecutive-soft`);
- the worst-case estimate must stay under the test timeout (`timeout-risk`). With the repo defaults that means at most 5
  soft assertions at 10 s each, or more with a shorter `{timeout: n}` per soft assertion.

### How the real emitted specs fare

Run against the committed emitted specs (verbatim copies are in `fixtures/specs/` and asserted by the self-test):

| Spec                                                                                                                  | Result                                                                                                                                                                                                                                                                                                                         | Judgement                                                                                                                                                        |
| --------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `explorer-proto/generated/pilot_01_mx_05.spec.ts`                                                                     | `soft-declared` x8, `soft-consecutive` (6 in a row), `timeout-risk` (worst case 90 s against 60 s)                                                                                                                                                                                                                             | The spec is wrong, not the rule. 8 soft assertions at 10 s can exceed the 60 s test timeout (lesson 2). The documented soft choice is allowed only with markers. |
| `explorer-proto/generated/pilot_02_mx_21.spec.ts`                                                                     | `absence-exact-name` x4 (`Unarchive`, `Edit`, `Notification Preferences`, `Channel Settings`), `soft-declared` x2                                                                                                                                                                                                              | The spec lacks the marker. The earlier pilot did run absence probes, but the spec does not name them. Lesson 1 requires the probe id on the line.                |
| `explorer-proto/sessions/bookmarks/generated/channels_bookmarks_bar_follows_switch.spec.ts`                           | pass                                                                                                                                                                                                                                                                                                                           | Hard assertions only; absence checks use a regex name.                                                                                                           |
| `e2e-tests/playwright/specs/functional/channels/notifications/channel_auto_follow_new_threads.spec.ts` (journey mode) | `random-data` (`pw.random.id()`), `label-missing` x6 (REST read-backs and preconditions carry no label), `unread-suffix` (exact `incidents public channel` link in a spec that posts), `absence-exact-name` (`No followed threads yet`), `regex-presence` (`/Thread/` heading), `get-by-text-presence` x2 (`getByText(REPLY)`) | The rules are right and the spec lacks markers and labels. Thread-list and `Threads` links are correctly not treated as sidebar links.                           |

`fixtures/specs/conformed_pilot_0{1,2}.spec.ts.txt` are the two pilot specs with only the markers, bounded soft
timeouts and a re-asserted hard assertion between soft groups added. They pass, and show what the v2 emitter should
produce.

## Exit codes

All gate CLIs: **0** pass, **1** fail, **2** usage error or unreadable input that is not evidence, **3** blocked.
`lessons_guard.mjs`: 0 allowed, 1 refused, 2 usage. `promote_decision.mjs`: 0 `promote_pr`, 1 `reject`, 3 `quarantine`,
2 usage (including a quarantine without `--owner`). `policy_hash.mjs`: 0 ok, 1 mismatch or not approved.

A gate module never throws and never reports `pass` on bad input: a crash, a missing field or an empty `ctx` returns
`blocked` with `evidence: [{rule: 'input', detail}]`.

## JSON interfaces

Every `gate.run(ctx)` returns `{status: 'pass'|'fail'|'blocked', evidence: [...]}` (and may add counters). `ctx` is a plain
object; unknown fields are ignored.

| Gate                   | `ctx`                                                                                | Evidence items                                                                                           |
| ---------------------- | ------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------- |
| `static_spec`          | `{files, config?, testTimeoutMs?, expectTimeoutMs?, maxConsecutiveSoft?, probeIds?}` | `{rule, file, line, snippet (<= 80 chars, quoted text redacted), detail?}`                               |
| `replay_judge`         | `{reports: [path\|object], expectation}`                                             | `{rule, test?, detail?}`; also `observed` (`pass`, `control-fail`, `invalid`) and `counts`               |
| `stability_20`         | `{reports: [path\|object], expected?: 20, logs?: [path], traces?: [path\|object]}`   | `{rule, count, expected?}` and `counts`; never messages                                                  |
| `mutation_control`     | `{plans: [plan\|path], runSpec}`                                                     | `{rule: 'control', id, result, reason?, states}`; also `spec_status` (`pass`, `fail`, `control blocked`) |
| `lessons_guard`        | `{lessons: [path\|object]}`                                                          | `{rule, lesson, detail?}`                                                                                |
| `containment_evidence` | `{record: object\|path, specFile?, minRaceIterations?}`                              | `{rule, result}`                                                                                         |

Expectation (`replay_judge`): `{mode: 'pass'|'control-fail', expected_test, expected_failing_assertion_text,
expected_message_fragments[], must_pass_tests[], expected_executions?}`. A `control-fail` expectation passes only when
`expected_test` ran once, failed cleanly with exactly one error at the named call (compared on normalised call text, not
line numbers), carries every message fragment, and every other test passed. Rejected: `Test timeout`, `timedOut`,
`interrupted`, skipped, flaky, retried or retries configured, a hook or fixture error, `Network guard violations`,
route-handler errors, a closed page, an error raised outside the spec file (hook, fixture or helper), any extra error, a failure with no code frame, a different assertion, a stats or
test-count mismatch, report-level errors.

`mutation_control` plan: `{id, control (charter negative_controls entry, id must match), vars, precondition: {read, expect},
mutator, mutation_readback: {read, expect}, restore, restore_readback: {read, expect}, expectation (control-fail),
run_spec?: {cmd}, reports?}`. An action is `{cmd: "template" | [argv]}` (run without a shell; `{name}` filled from `vars`;
exit non-zero, or a stdout JSON `status` outside 2xx, means rejected) or `{rest: {method, url, headers?, auth_env?, body?}}`
(loopback only; `auth_env` names an environment variable, never a value). `expect` is a list of `{path, equals}` or
`{path, not_equals}`. States: `precondition`, `mutate`, `verify_mutation`, `run_spec` (caller hook `runSpec(ctx) ->
{reports, exit_code?}` or `plan.run_spec`), `judge`, `restore`, `verify_restore`. A rejected or unapplied mutation is
`blocked` (lesson 4); a failure elsewhere, a control that did not fail, or an exit code of 0 is `fail`; restore runs
whenever the mutator was invoked and a failed restore or read-back is `fail`, which beats everything else. Command output
is never copied into the result.

`promote_decision.mjs` prints `decision: ...` and `why:` lines (`--json` for the object). The verdict is validated against
the v2 `verdict` schema. The policy gate ids map to verdict gate names: `schema`, `leakage`, `duplicate_gate` ->
`duplicate`, `static_spec` -> `lint`, `stability_20` -> `stability`, `mutation_control` -> `control_sensitivity`,
`secrets_scan` -> `secret_scan`, `containment_evidence` -> `guard`.

Containment record: see the header of `containment_evidence.mjs`. `--from-journey-report guard-journey-report.md --spec-as-run
--spec f --config f` converts the journey-mode containment report. The committed one documents a residual gap (a second
127.0.0.1 origin on another port is reachable, one server hit), so the gate returns `fail` on it, with the missing
exploration, service-worker and race evidence as `blocked` items; closing the gap alone would still give `blocked`. `--from-guard-report guard-report.md --race
guard-race-report.md` converts the engine's reports; the result is `engine_only` and therefore `blocked` until the run
that produced them attests `--spec-as-run --spec <file> --config <file>`.

## Adding a gate

1. Create `<name>.mjs` exporting `gate = {id, run(ctx)}` that returns `{status, evidence}`, wraps its body in
   `guarded(...)` from `common.mjs` so a crash is `blocked`, and has a CLI that exits with `EXIT` codes. Start the CLI
   with `runCli(main)` guarded by the `import.meta.url` check, without a top-level `await` (a self-test importing the
   module would otherwise deadlock).
2. Add `<name>.selftest.mjs` exporting `selftestChecks()` with at least one bad input per rejection and one good input;
   register it in `selftest.mjs` (`SUITES`, and `GATE_MODULES` for the interface checks).
3. If promotion depends on it, add it to `promotion_policy.json` `required_gates` with its verdict gate name (and to
   `REQUIRED_GATE_IDS` in `promote_decision.mjs`). The verdict schema's gate names are a closed list in
   `../schemas/common.schema.json`, so a brand-new verdict gate needs a schema change.
4. Update this catalog, run `selftest.mjs` and Prettier, then follow [POLICY-CHANGE.md](POLICY-CHANGE.md).

## Layout

`common.mjs` shared helpers. `fixtures/` holds the bad and good spec snippets (`static_cases.mjs`), hand-written
Playwright report builders (`report_fixtures.mjs`), copies of the real emitted specs, and the engine guard reports.
`approvals.json` records human approvals of a combined hash (empty until a human approves).

Estimating flakiness honestly: `node explorer-proto/v2/gates/stability_gate.mjs --estimate-flake 0 20` prints the exact
Clopper-Pearson one-sided 95% upper bound (13.9%); add `--two-sided` for the interval. `--runs-for 0.05` prints how many
failure-free runs are needed to bound the rate below 5% (59).
