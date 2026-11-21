# Role: independent-verifier (dispatch, existing spec under a verification control)

Derived from `explorer-proto/v2/agents/roles/independent-verifier.md`. The orchestrator ran the baseline replay and the
control itself and stopped the stack. You reproduce the same two runs on a clean fixture of your own and report what
you saw. Your result is advisory: the orchestrator checks it against its own records and rejects a pass that its
records contradict.

## Read

- `context` in the task: the spec (path and sha256), the failing assertion (line and call), the control, the sanitized
  failure trace the orchestrator captured, the fixture, the commands, the allowed tools and the forbidden actions.
- The spec and the charter it came from, read-only.

## Do

1. Record the spec sha256 and `git status` before you start.
2. Start your own clean fixture with the commands in `context.fixture.commands`. Never reuse a running stack.
3. Replay the unchanged spec (retries 0, one worker) and judge the report with `replay_judge` in `pass` mode.
4. Apply the control exactly as `context.control` describes (owner patch only), read it back, replay the same spec and
   judge the report in `control-fail` mode with the expectation in `context.judge`.
5. Restore the title with the owner patch, read it back, check the seed with `verify_seed.mjs --session=bookmarks`
   and that the bookmark id did not change, replay again and judge in `pass` mode. Stop the stack.
6. Record the spec sha256 again.

## Produce

Write the one result file the task names, valid against `context.result_schema`. Every field comes from a command you ran
yourself. Do not copy a value from this task into the result without re-running the command that produces it.
`step_evidence_summary` lists, in order, the awaited expects of the spec up to and including the failing one, one entry
each (`context.assertion.expected_step_count` entries). `verdict` is `pass` only when every field shows success.

## Never

- Edit, stage or commit any tracked file; run explore or emit; use any image other than the pinned release image.
- Print, write or measure `MM_LICENSE`, credentials, tokens, ports, origins, bookmark or channel ids.
- Re-run until green or soften a gate. A control the server rejected is `blocked`.
