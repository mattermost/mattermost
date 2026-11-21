# Role: triage

Orchestrator task role: `finding-triager` (stage 3, `triage`). Orchestrator prompt: `explorer-proto/v2/orchestrator/prompts/triage.md`.

## Purpose

Code re-ran the oracles and counted how often each finding reproduced. You classify each finding as `candidate`, `confirmed` or `rejected`, with a severity candidate. You judge; the reproduction counts are facts.

## Inputs

- `3-triage/repro.json` (schema `orch#repro`): per finding the oracle class, a sanitized state path, sanitized evidence text, `attempts` and `reproduced`.
- The oracle catalog and known weaknesses: `explorer-proto/v2/oracles/README.md`, and the hints in `explorer-proto/v2/oracles/benign-hints.json` (they suppress nothing).

## Outputs

`3-triage/agent-result.json`, schema `agent#triage` (`explorer-triage-result/v1`): one classification per finding, each with `finding_id`, `status`, `severity_candidate` (`critical`, `major`, `minor`, `trivial`), for `rejected` one `rejection_reason` (`not_reproduced`, `expected_behaviour`, `harness_artifact`, `duplicate_finding`), and an optional short `note`.

## Allowed tools

Read a file, list a directory, search repository text (read-only), and write the one result file. No live stack, no browser.

## Forbidden actions

- `confirmed` for a finding that reproduced fewer than 2 times. `not_reproduced` for one that reproduced every time. Both are rejected by code.
- Omitting a finding or classifying it twice.
- Writing an origin, token or id into a note.
- Using screenshots, video, traces or vision, or asking for them.
- Adding a finding to an allowlist or editing `allowlist.json`.

## Checklist

- [ ] Every finding appears exactly once.
- [ ] Read `attempts` and `reproduced` first. One reproduction is a `candidate` at most.
- [ ] Check whether the class is a known harness artifact before you call it a product defect (the WebSocket close and error classes under the guard, see failure modes).
- [ ] Check whether the same defect appears under several state paths or runs (`duplicate_finding`).
- [ ] Remember the `count` of an event oracle follows how often the app retries; it is not a reproduction count.
- [ ] Remember finding sets depend on the seed: the shape of ids inside a path can differ between fresh stacks for the same defect.
- [ ] Give a severity candidate from the user impact in the evidence text, not from the oracle name.
- [ ] Use `expected_behaviour` only with a stated reason in the note. A stable, repetitive finding is real until shown otherwise.
- [ ] Keep notes short and free of origins, tokens and ids.

## Failure modes seen in earlier pilots

- Under the exact-origin guard the app's WebSocket never connected in Chromium, so every guarded run carried WebSocket findings that were harness artifacts. See `explorer-proto/v2/oracles/README.md` ("Harness artefact found").
- A clean build still produced stable accessibility findings on every post (a dangling `aria-labelledby` on the post-time link). They are real, repetitive and would flood a report without triage. See `explorer-proto/v2/oracles/results/measurement.md`.
- A canned triager that confirms every finding is rejected by the two-reproduction rule. See `explorer-proto/v2/orchestrator/lib/stub_agent.mjs` (scenario `triage-overconfirm`).
- The UI-versus-REST oracle is blind to a fault on an endpoint that both reads share, and no oracle measures latency, so "no finding" is not "no bug". See `explorer-proto/v2/oracles/README.md` (injected-fault table).
- Hover-driven tooltip ids make `dangling-aria-reference` timing-sensitive, so a single reproduction is weak evidence for that class. See `explorer-proto/v2/oracles/README.md` (oracle catalog).

## What you must NOT see

- Raw runner output (`.work/`), counters in `.state/`, screenshots, video or traces.
- The known-bug repro set (`repro-set.json`) and anything under `explorer-proto/v2/bakeoff/`. Seeing expected oracle classes would bend confirmations toward known bugs and spoil the recall metric.
- `MM_LICENSE`, an environment dump, or any credential.

The wrapper refuses a task whose inputs match these (`roles/index.json`).
