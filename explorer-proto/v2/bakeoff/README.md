# Pilot v2 bakeoff harness

Read `PREREGISTRATION.md` first: it is the frozen protocol (versions, targets, held-out features, metric formulas, the
decision rule and the threats to validity). This harness measures and reports. It does not run a bakeoff by itself, and no
bakeoff has been run. Every script is Node 24 `.mjs`, built-ins only plus Ajv from `e2e-tests/playwright/node_modules`, with
no network access. Output is deterministic; compared artifacts hold no timestamps.

```bash
node explorer-proto/v2/bakeoff/selftest.mjs      # schemas, leakage checker, report verdicts, collectors
```

## Files

| File | Purpose |
| --- | --- |
| `PREREGISTRATION.md`, `rules.json` | The protocol and its machine-readable rules. `report.mjs` only reads `rules.json`. |
| `freeze.mjs`, `freeze.config.json` | Records git SHA and sha256 of schemas, gate modules, protocol files and inputs into `FREEZE.json`. Never tags. `--dry-run`, `--verify`. |
| `result_set.mjs` | `init` a result set for A or B from `target.json`; `set` a metric section from a validated fragment. |
| `metrics.mjs` | Wraps one stage command: exit code, elapsed seconds, agent calls counted from `agent-calls.jsonl`. Writes a sanitized record into `cost.stages`. |
| `record_cost.mjs` | Manual entries: human review minutes, agent rounds, fix rounds, cost-to-gain justifications. |
| `leakage_check.mjs` | Charter route-leakage rules. `PASS` or `FAIL` plus offending paths. |
| `build_deny_list.mjs`, `deny_labels.json` | Control labels of other sessions, derived from `sessions/*/charter.json` and `scenarios.json`. |
| `recall.mjs` | Known-bug recall from a `repro-set.json` and finding files (v2 only). |
| `shuffle_goal.mjs` | Deterministic goal-word shuffle for the bias ablation. |
| `baseline_v1.mjs` | The numbers that exist in the v1 artifacts, read from git objects at the frozen v1 commit. |
| `report.mjs` | Table plus `PASS` or `FAIL` per decision clause for two result sets. Never writes. |
| `selftest.mjs` | Checks all of the above. |

## Inputs you provide before the freeze

`inputs/goals.json`, `inputs/controls.json` (required) and `inputs/repro-set.json` (optional, from the lead). Shapes are in
PREREGISTRATION.md section 4. Edit `freeze.config.json` first if the v2 gate modules are not under `explorer-proto/v2/gates`.

## Run order (when a bakeoff is run)

```bash
B=explorer-proto/v2/bakeoff
node $B/freeze.mjs                                           # once, clean tree; commit FREEZE.json
node $B/result_set.mjs init --label A --target target.json --out result-A.json
node $B/result_set.mjs init --label B --target target.json --out result-B.json
node $B/metrics.mjs --result result-B.json --stage explore --agent-calls agent-calls.jsonl -- <stage command>
node $B/leakage_check.mjs --fragment leak-B.json charters-B/*.json
node $B/result_set.mjs set result-B.json route_leakage leak-B.json
node $B/record_cost.mjs result-B.json --reviewer <handle> --human-review-minutes 20 --fix-rounds 1
node $B/recall.mjs --repro-set inputs/repro-set.json --findings findings/ --out recall.json   # v2 only
node $B/result_set.mjs set result-B.json known_bug_recall recall.json
node $B/report.mjs --a result-A.json --b result-B.json
```

Exit codes: `report.mjs` 0 v2 better, 1 not shown better, 2 invalid input or protocol tampering. The other scripts exit 0 on
success, 2 on a usage or validation error; `metrics.mjs` returns the wrapped command's exit code.

Stage commands may contain secrets in their environment. `metrics.mjs` inherits the environment and the output streams
and stores neither; it records only the executable's base name and the argument count.

## Leakage checker

```bash
node explorer-proto/v2/bakeoff/leakage_check.mjs [--deny-list f] [--fragment out.json] [--json] <charter.json>...
```

Rules, defaults and the schema relationship are described in `../schemas/README.md`. Legacy v1 charters, which have no
`leakage` section, are checked with all five rules and the full exemption list. The checker prints `info: named_controls=N`:
the number of `allowed_actions` entries, which is human-supplied route knowledge that the rules do not count.

### Calibration on the existing charters

Only two charters exist in the repository (`sessions/bookmarks`, `sessions/auto-follow`). A third was requested; none is present.

| Charter | Result | Notes |
| --- | --- | --- |
| `sessions/bookmarks/charter.json` | PASS | Validates as a legacy v1 session charter. Its 3 allowed controls are its own labels, so they are not leakage. |
| `sessions/auto-follow/charter.json` | FAIL (2 paths) | `L4 events[0].ordering` and `L4 events[0].requests`: the journey event holds an ordered REST request list ("root then reply"). By design the v2 schema defines no such field; an event names a primitive action plus params. Judged a true positive, not weakened. No prose rule fired on either charter. |

Before settling on the rules, every prose string of both charters was scanned with all patterns and no exemptions: the only
hit was a numbered read-back checklist in `auto-follow` `fixture.read_back` (exempt fixture procedure). No false positive
needed fixing.

## Baseline

```bash
node explorer-proto/v2/bakeoff/baseline_v1.mjs [--json]
```

Reads `git ls-tree` and `git show` at `9c6927a30f5e5d3d380d8b2ea9b109080490d2c3`. It extracts: spec files (3) with literal
counts of `test(` and `expect(` calls; controls declared in `scenarios.json` (2) and session charters (1) and implemented in
`run-pilot.sh verify` (3); discovery counters from the two committed `trace.json` files. It reports `not recorded` for
elapsed time, agent calls, fix rounds, human review minutes, replay stability and control-sensitivity results: none of those
were stored as numbers, and determinism claims in the README are not recorded as results.
