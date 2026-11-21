# Pilot v2 bakeoff: pre-registered protocol

Status: this protocol is frozen when `FREEZE.json` is committed (see [Freeze](#12-freeze)). Nothing in this file, in
`rules.json` or in the harness may change after that point. A change means a new freeze and a new, separately reported
bakeoff. `report.mjs` refuses to run if `rules.json` or this file differs from `FREEZE.json`.

Purpose: compare the process built so far (v1) with the program-driven pipeline (v2) on the same targets and the same
held-out features, with rules written before any result exists. Results are indicative (see
[Threats to validity](#11-threats-to-validity)).

## 1. Versions

| Label | Name | Definition |
| --- | --- | --- |
| A | v1 frozen | Git commit `9c6927a30f5e5d3d380d8b2ea9b109080490d2c3` (the independently verified state: pilot specs, bookmarks session mode, committed traces). The later journey-mode work (`sessions/auto-follow`, journey charter design) on another branch is excluded. A is run from a checkout of exactly this commit. |
| B | v2 | The commit recorded as `version_b.frozen_sha` in `FREEZE.json`, created by `freeze.mjs` before the first bakeoff run. No tag is created or pushed by the harness. B is run from exactly that commit. |

Both versions are given the same fixtures, targets, goals, budgets, controls and reviewers (sections 3 to 5).

## 2. Targets

| Role | Target | Recorded in `target.json` (schema `target`) |
| --- | --- | --- |
| Primary (decisive) | `main` branch (the repository default branch, `master`): head SHA recorded at run time, on the development image of that head | `kind: main`, `ref`, `sha`, image `ref` and `digest`, server version, `licence_check` as PASS or FAIL only, Playwright version, browser build |
| Secondary reference (indicative only) | The licensed 12.1.0 release: `mattermost/mattermost-enterprise-edition:12.1.0@sha256:059c6ae272a7d54c1f38ed946fb6005aca7b02a096192800da8ee0bd79ade0e7`, tag `v12.1.0` | the same fields, `kind: release` |

Rules:

- The main SHA and the image digest are written once, before A and B run, and both result sets must carry identical
  `kind`, `sha` and `image_digest`. `report.mjs` exits 2 otherwise.
- A target whose `licence_check` is FAIL is a setup failure, never a run on a different edition. `result_set.mjs init`
  refuses it. The licence value is never printed, stored, hashed or measured.
- The decision rule applies to the primary target only. The report labels any other target "secondary, indicative".

## 3. Held-out features

| Id | Feature | Matrix area | Expected disposition | Notes |
| --- | --- | --- | --- | --- |
| F1 | Channel creation modal and custom-time modals: typed input, Enter submit | channels | `emitted_passing` | Ties to the open Jira bugs MM-71783, MM-71784, MM-71786, MM-71787, MM-71788 and MM-71781. Needs typed input and the Enter key. |
| F2 | Favorites persistence after a channel switch and after a reload | channels.navigation | `emitted_passing` | |
| F3 | Request acknowledgement on a message | messages.compose | `emitted_passing`, or `rejected_unreachable` with reason `licence_insufficient` | Needs a Professional licence. The rejection counts only with licence evidence. |
| F4 | Planted duplicate: the bookmark-open flow | channels.bookmarks | `rejected_duplicate` | Already covered by Playwright `MM-T5611` at `e2e-tests/playwright/specs/functional/channels/channel_bookmarks/bookmark_display_navigation.spec.ts:38`. Both versions must reject it. |

The expected dispositions are in `rules.json` (`features`) and are used by the report. F1 to F3 are expected to be
emitted: an emitted spec that the blind reviewer judges equivalent to existing coverage is not "handled".

A feature is **handled** when its outcome (verdict schema `outcome`) is one of its expected outcomes and all of these hold:

- `emitted_passing`: the spec was emitted, passed every gate in its verdict (`gates_all_passed`), and the blind reviewer did not judge it `equivalent` to existing coverage.
- `rejected_duplicate`: the rejection cites the covering test as evidence (`duplicate_of` in the verdict) and the blind reviewer did not judge the proposal `non_equivalent`.
- `rejected_unreachable`: the rejection carries evidence references and an allowed `unreachable_reason` (F3: `licence_insufficient` only).

Anything else (`failed`, `blocked`, an unexpected outcome, a missing record) is not handled.

## 4. Frozen inputs

All inputs live in `explorer-proto/v2/bakeoff/inputs/` and are hashed by `freeze.mjs`. They are written once by someone
who does not implement v2, before the freeze.

| File | Content |
| --- | --- |
| `inputs/goals.json` | `{"F1": {"original": "...", "paraphrased": "..."}, ...}` for F1 to F4. `original` is one first-person goal sentence. `paraphrased` keeps the meaning and shares as few content words as practical. The **shuffled** variant is computed, never written by hand: `shuffle_goal.mjs` (FNV-1a 32-bit of `<feature>\n<original>` seeds mulberry32; Fisher-Yates over the whitespace-split words). |
| `inputs/controls.json` | `{"F1": [{"id", "change", "expected_failing_assertion"}], ...}`: the negative controls for each feature. A control is one seed or role change that keeps navigation intact. The same control set is applied to whatever spec each version emits for that feature. F4 has none. |
| `inputs/repro-set.json` | Optional, provided later by the lead (schema `repro-set`): the listed Jira qa-exploration bugs that still reproduce on the main SHA, each with `id`, `summary` and `expected_oracle_class`. It is hashed when present. It only feeds the v2-only bug-oracle metrics. |
| `rules.json` | The machine-readable rules (schema `bakeoff-rules`), including the discovery budget. |

**Discovery budget** (same for both versions, in `rules.json`): `max_actions` 240, `max_depth` 9, `max_states` 200,
`max_replays` 260, `wall_clock_seconds` 3600. These are the budget values of the existing journey-mode design, reused so
no number is invented for the bakeoff.

## 5. Procedure

1. Record `target.json`; `result_set.mjs init` creates one result set per version.
2. Both versions process F1 to F4, each from its original goal text. Every stage runs under `metrics.mjs`.
3. Every replay uses a fresh fixture (new team, users, channels, preferences), a single Playwright worker, and
   `retries: 0`. Nothing is reused or reset between replays.
4. Stability: each emitted spec is replayed 20 times.
5. Control sensitivity: each control from `controls.json` is applied to each emitted spec of its feature, replay only (no re-explore, no re-emit), then restored and read back.
6. Discovery ablation: F1 to F3 are run again from the paraphrased goal and from the shuffled goal, within the same budget.
7. Route leakage: `leakage_check.mjs` is run over the charter each version used for each feature.
8. A blind second reviewer, who is neither the v2 implementer nor the lead, judges each proposed (emitted) spec `equivalent` or `non_equivalent` to existing coverage. The reviewer sees the spec and the coverage index candidates but not the version label.
9. v2 only: known-bug recall and clean-build false positives (section 6, M7 and M8).
10. Human review minutes, agent rounds and fix rounds are entered with `record_cost.mjs` as they happen.

Nothing is run twice to pick the better outcome. A repeated stage is recorded as another stage record and counts toward cost.

## 6. Metrics

Each metric has a formula and a data source. "Not recorded" means the result-set section is absent. Zero is recorded
only when it is entered explicitly.

| Id | Metric | Formula | Data source |
| --- | --- | --- | --- |
| M1a | Planted duplicate rejection | `planted_rejected / planted_total`. Planted set: F4. Rejected means outcome `rejected_duplicate` with `duplicate_of` equal to the covering test in `rules.json`. | `duplicate_rejection`, F4 verdict |
| M1b | Non-equivalent proposals | `proposals_non_equivalent / proposals_reviewed`. Proposals are the emitted specs. Equivalent means: same actor, same trigger and the same asserted outcome as an existing test. | blind reviewer, `duplicate_rejection` |
| M2 | Stability | `stability_rate = specs with passed = 20 / emitted specs`. Replays per spec: 20, fresh fixtures, retries 0. A version with no emitted spec has rate 0. The pooled pass fraction `sum(passed) / (20 * specs)` is reported for information. | `stability.specs` |
| M3 | Control sensitivity | `control_sensitivity_rate = controls with result pass / all controls applied`. A control is `pass` only if the replay fails at the named assertion (matched on the call text and expected strings, not line numbers), every earlier assertion passes, no navigation step fails or times out, and the restored fixture replays green. `fail` is any other result. `blocked` means the control could not be applied or restored (licence, missing API, environment). Blocked controls stay in the denominator, are reported as blocked and never count as pass. | `control_sensitivity.controls` |
| M4 | Discovery success | `discovery_rate = successful runs / runs`, over F1 to F3 and the variants original, paraphrased, shuffled. A run succeeds when the program-judged discover stage reaches a state satisfying the feature checkpoints inside the fixed budget. Reported per variant. Bias ablation: `drop = rate(original) - min(rate(paraphrased), rate(shuffled))`. | `discovery.runs` |
| M5 | Route leakage | Sum over the charters of `leakage_check.mjs` violations (one per rule and JSON path), with the frozen `deny_labels.json`. `named_controls` (entries in `allowed_actions`) is reported for information and is not in the decision. | `route_leakage` |
| M6 | Features handled | Count of F1 to F4 handled (section 3). | `features` |
| M7 | Known-bug recall (v2 only) | `flagged / reproducing_total` over the bugs in `repro-set.json` with `reproduces` not false. A bug is flagged when a confirmed finding has the bug's `expected_oracle_class` and, if the bug lists a state path, that exact path (`recall.mjs`). | `known_bug_recall` |
| M8 | False positives on a clean build (v2 only) | Run the oracles on the secondary release target with the default seed and no injected faults. `false_positives` = confirmed findings that a human adjudicates `false_positive`; `false_positives_per_100_states = 100 * false_positives / states_explored`. Confirmed findings without an adjudication are reported as unadjudicated. This section is recorded in B's result set for the release target, so run `report.mjs` on the release result sets to see it. | `false_positives` |
| M9 | Cost | Four components, pipeline stages only (measurement stages are excluded for both versions): `elapsed_seconds` = sum over pipeline stage records; `agent_calls` = sum of agent calls counted from `agent-calls.jsonl` plus manually entered agent rounds; `fix_rounds` = manual; `human_review_minutes` = manual. | `cost` |

Agent calls are the JSON-object lines a stage appends to `agent-calls.jsonl` while it runs. For A, whose conversational
process did not log calls, agent rounds are entered manually from the session transcript.

## 7. Decision rule

The verdict is computed by `report.mjs` from `rules.json` and the two result sets. It is exactly this (the clause titles
below are printed verbatim by the report and checked by `selftest.mjs`):

<!-- DECISION-RULE-BEGIN -->
v2 counts as better only if ALL of the following clauses hold on the primary target:

- C1 Stability: v2 is not worse than v1
- C2 Control sensitivity: v2 is not worse than v1
- C3 Held-out features: v2 handles at least 3 of 4, no fewer than v1, and rejects F4
- C4 Route leakage: v2 has no more violations than v1
- C5 Cost: every component is at most 1.5x v1, or each excess is tied to a measured gain
<!-- DECISION-RULE-END -->

Definitions used by the clauses:

- **C1** `stability_rate(B) >= stability_rate(A)` (M2, compared as exact fractions; a denominator of 0 counts as rate 0).
- **C2** `control_sensitivity_rate(B) >= control_sensitivity_rate(A)` (M3, same comparison).
- **C3** all three hold: `handled(B) >= 3`; `handled(B) >= handled(A)`; feature F4 is handled by B (rejected as the planted duplicate).
  The task wording "no more than v1" is read as "no fewer than v1": v2 may not handle fewer features than v1.
  If A does not reject F4, the report shows it; it does not change the clause for B.
- **C4** `violations(B) <= violations(A)` (M5).
- **C5** for each component k in `elapsed_seconds`, `agent_calls`, `fix_rounds`, `human_review_minutes`: `B_k <= 1.5 * A_k`.
  A component above that limit is excused only if `B.cost.justifications` lists it with a `gain_metric` in
  `features_handled`, `stability_rate`, `control_sensitivity_rate`, `discovery_rate`, and that metric is strictly better
  for B than for A in the result sets. Every excess needs its own justification. If `A_k` is 0, any `B_k > 0` is an excess.

Missing data: a clause with any not-recorded input FAILS, and the printed detail says which input is missing. v2 counts
as better only when every clause prints PASS. Otherwise the report prints "v2 NOT SHOWN BETTER" and lists the failed clauses.

**Reported separately, never part of the decision:** known-bug recall (M7) and false positives (M8) for the bug oracles;
duplicate rejection (M1a, M1b); discovery success and the bias ablation (M4); named controls; the secondary target.

## 8. Integrity rules

- `report.mjs` and every other script only read the rules. None of them writes `rules.json`, this file or `FREEZE.json`.
- No timestamps appear in any compared artifact. Stage records keep start and end times in a `volatile` object that the report never reads.
- No script uses the network. Records are refused if they contain an origin, a loopback host, session material, or a 26-character server id.
- Result files are never overwritten by `result_set.mjs init`. `FREEZE.json` is never overwritten.
- Any deviation from this protocol is stated in the report's cover note. The rules are not edited to fit a result.

## 9. What the harness does not decide

- Which Cursor agent, model or prompt each version uses is part of the version, not of this protocol.
- Whether a Jira bug "still reproduces" on the main SHA is the lead's judgement, delivered as `repro-set.json`.
- Whether a confirmed clean-build finding is a false positive is a human adjudication.

## 10. Calibration of the leakage checker

`leakage_check.mjs` was calibrated before this protocol was frozen on the two charters that exist in the repository
(`sessions/bookmarks`, `sessions/auto-follow`). The outcome is in `README.md`. The checker's rules are part of the frozen
harness and apply identically to both versions.

## 11. Threats to validity

- **Small sample.** Four features, one target pair, one run per variant. A single flaky replay or one unlucky agent run can flip a clause. No confidence interval is computed.
- **Authors know the features.** The features were chosen by people who know them and who also built the process under test. The examples shipped with the schemas deliberately use other features, but contamination through shared knowledge cannot be excluded.
- **v1 baseline gathered informally.** v1 timing, cost and replay results were never recorded as numbers (`baseline_v1.mjs` reports them as "not recorded"). A's cost and rounds are entered manually, so they are less exact than B's automated counts.
- **Synthetic injected faults.** Negative controls are seed or role changes, not product regressions. Control sensitivity shows that assertions can fail for the named reason, not that a real regression would be caught.
- **Agents are LLMs.** Outputs are non-deterministic and model-dependent. The paraphrase and shuffle ablation probes goal-wording bias but does not remove it.
- **Leakage measurement is syntactic.** The checker finds ordered-step phrasing, numbered lists, other sessions' control labels and undefined keys. It cannot see a semantic hint. The v1 control allowlist is route knowledge supplied by a human and is counted only as information.
- **Moving target.** `main` changes. The SHA and image digest fix it for one bakeoff only.
- **F3 depends on the licence.** If the test licence is not Professional, F3 can only be handled by a licence-evidenced rejection.

Because of these threats, results are **indicative**. "v2 better" means "not worse than v1 on every pre-registered clause in
this sample", not a general claim.

## 12. Freeze

```bash
node explorer-proto/v2/bakeoff/freeze.mjs --dry-run   # inspect: git SHA, hashes, missing required paths
node explorer-proto/v2/bakeoff/freeze.mjs             # write FREEZE.json (clean tree, all required paths present)
node explorer-proto/v2/bakeoff/freeze.mjs --verify    # recompute and compare
```

`FREEZE.json` records the v1 commit, the v2 `frozen_sha` (`git rev-parse HEAD`), the tool versions, and the sha256 of
every file in the schemas directory, the harness directory (including this file and `rules.json`), the gate modules
(`explorer-proto/src/*.ts` and `explorer-proto/v2/gates/*`) and the inputs. Edit `freeze.config.json` first if the v2 gate
modules live elsewhere. Commit `FREEZE.json`, then run B from `frozen_sha`. No tag is created or pushed by any script.
