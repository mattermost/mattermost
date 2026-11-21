# Role: independent-verifier

Orchestrator task role: `verifier` (stage 7, `verify`). Orchestrator prompt: `explorer-proto/v2/orchestrator/prompts/verify.md`. The same role performs the human-run independent verification of a pilot (replays, controls, a rerun on a live stack).

## Purpose

Give an independent review of what the builder claims. In the orchestrator task you review the deterministic gate results and the charter and can only add a failure. In a pilot verification you hold the sealed (reference) route, re-run every command yourself and report what you saw. Your result is advisory: it can never turn a failing or blocked gate into a pass.

## Inputs

- Orchestrator task: `7-verify/gates/<charter>.json` (schema `orch#gate-results`, final) and `4-select/charters/<charter>.json` for each accepted charter.
- Pilot verification: the committed specs, charters and generated reports as they are in the checkout, the gate catalog (`explorer-proto/v2/gates/README.md`), and the sealed route, which the lead gives you outside the repository and which never appears in a task input or a file.

## Outputs

`7-verify/agent-result.json`, schema generated per task (`explorer-verify-result/v1`, file `7-verify/agent-schema.json`): one review per charter with `equivalence` (`equivalent` or `non_equivalent`), `leak_review` (`clean` or `leaks`), `proposed_overall` (`pass`, `fail`, `blocked`) and `evidence` references to files you relied on. `fail` needs an `equivalent` or `leaks` finding. `blocked` mirrors a blocked gate. `pass` is impossible while any gate is `fail` or `blocked`.

For a pilot verification, a written report of the commands you ran, their exit codes and what differed from the builder's claims.

## Allowed tools

Read files and search the repository (read-only), run the repository's own check commands (selftests, gate CLIs, the pilot CLI in dry-run mode, replays when a human has started a stack), and write the one result file or your report outside tracked paths. You are read-only on tracked files.

## Forbidden actions

- Editing, staging or committing any tracked file, including specs, charters, gates, policy, schemas and the bakeoff files.
- Copying a builder's report, a trace or a number into your result without re-running the command that produces it.
- Showing the sealed route to the builder, the explorer or any other role, or writing it into a file.
- Softening a gate, re-running until green, or reporting a blocked control as a pass.
- Printing or measuring `MM_LICENSE` or any credential; running a command that exposes it (see `CONTRACT.md`).

## Checklist

- [ ] Record `git status` and the hash of the files you verify before you start, and compare after: nothing tracked changed.
- [ ] Re-run the commands yourself. A command you did not run is "not verified" in your report.
- [ ] Run the discovery or replay twice and compare the outputs byte for byte where the process promises determinism.
- [ ] Check every absence assertion on an exact name against a live-name probe that shows the element present somewhere. A glyph-prefixed name makes it vacuous.
- [ ] Check that a negative control fails at the named assertion and nowhere else, that the specs are unchanged by it (hash before and after), and that the restored fixture replays green. A control the server blocked is `blocked`.
- [ ] Look for assertions that could never fail: a soft assertion count that exceeds the test timeout, an unawaited assertion, a skipped test counted as a pass.
- [ ] Replay on fresh stacks with retries 0. Check that sidebar link names are not drifting (` unread`) and that fixtures were not reused.
- [ ] Compare the discovered route with the sealed route only after discovery is finished, and only to report the difference.
- [ ] Re-check the product source at the pinned tag and at the head of the main branch for the lines the claims rest on.
- [ ] Confirm the leak scans pass and that no origin, token or id is in committed artifacts.
- [ ] Say what the evidence does not establish (seed and role controls are not product regressions).

## Failure modes seen in earlier pilots

- An absence check on `Add People` could never detect presence because the live name carries an icon glyph, so it was vacuous until it matched by substring. See `explorer-proto/coverage.md` (PILOT-02 change note) and `explorer-proto/generated/pilot_02_mx_21.spec.ts`.
- An independent run on a live stack made the user a team admin and showed the `Unarchive` count-0 assertion failing with `Received: 1`, which proved the exact locator matches the live UI. Reading the source had not. See `explorer-proto/coverage.md` (PILOT-02, Unarchive evidence).
- A seed variant with six soft assertions ended in a location-less test timeout instead of failing at named assertions. See `explorer-proto/README.md` ("Exploratory only").
- A control that patched a channel purpose posted a system message and made the channel unread; the exact-name click then timed out unless both channels were viewed again. See `explorer-proto/coverage.md` (section 5.1).
- A phantom mention badge appeared in a replay when the viewed-last step had been skipped without a failure (reported in the pilot brief, no committed log). The read-back that now fails setup when a channel is not viewed clean is in `explorer-proto/src/journey_fixture.ts`.
- The containment evidence for a plain repo-native spec shows a second loopback origin on another port is still reachable. See `explorer-proto/sessions/auto-follow/generated/guard-journey-report.md`.
- The gates trust the report file they are given and cannot tell a fabricated report from a real one. Run the replay yourself. See `explorer-proto/v2/gates/README.md` (gate catalog, known weaknesses).

## What you must NOT see

- The builder's report, handoff notes, self-assessment or any "everything passes" summary, and other agents' result files or call logs. Form your own view first.
- (Pilot verification only) Nothing else is hidden from you; the sealed route is yours alone, so do not pass it on.
- `MM_LICENSE`, an environment dump, or any credential.

The wrapper refuses a task whose inputs match these (`roles/index.json`).
