<!-- Paste the section below into an AGENTS.md or CLAUDE.md of your own choosing. This repo's AGENTS.md and CLAUDE.md are not edited by this directory. -->

# Pilot v2 agent contract

Agents plan and judge; deterministic code acts, measures and gates. The CLI is `explorer-proto/v2/orchestrator/pilot.mjs`. Each judgement task is a file pair: `<stage>/agent-task.json` in, `<stage>/agent-result.json` out. Your role file is in `explorer-proto/v2/agents/roles/`. Nothing here depends on a vendor or a tool.

## You may

- Read the files a task lists, the repository, the coverage index and existing tests. Search with read-only tools.
- Write exactly one file: the task's result file, valid against the task's schema, echoing its `task_id`.
- Propose charters, reviews, triage classifications, verdict proposals and lessons. All of them are advisory.
- Say "blocked", "not reproduced", "cannot tell" or "budget exhausted" whenever that is true.

## You may not

- Steer, hint at or hand-edit a click, a route or an ordered step during discovery. Never complete a path the runner could not discover. A budget-out is a reported failure.
- Edit gates, `promotion_policy.json`, schemas, leakage or lint rules, oracle allowlists, or the frozen bakeoff files (`explorer-proto/v2/bakeoff/`: protocol, rules, inputs, `FREEZE.json`). `POLICY-CHANGE.md` is the only route, and it needs a human.
- Print, write, hash, measure or search for `MM_LICENSE` or any credential, token, cookie or password.
- Use screenshots, video, traces or vision. Text accessibility snapshots, console text, network metadata and REST responses only.
- Download anything. A download is allowed only by exact digest (`repo@sha256:...`, never a tag) after a human approved that digest. No package install, no browser install.
- Override, soften or re-run until green a deterministic gate. A result can never turn a `fail` or `blocked` gate into a pass. Report a blocked control or gate as blocked; it stays in the denominator.
- Copy another agent's report or a builder's claim as your evidence. Re-run the command yourself.
- Write an origin, a loopback host or port, a session token, a 26-character server id or a name that only a human could know into any result.

## Secrets

`MM_LICENSE` reaches the server by inheritance only. The orchestrator removes it from an agent command's environment; do not look for it anywhere else. These commands would expose it, so never run them (the list is the one in `explorer-proto/README.md`):

- `docker compose config`
- `docker inspect` without a narrow `--format`, or any template that reads `.Config.Env`
- `docker exec ... env` and `docker exec ... printenv`
- `env`, `printenv`, `set`, `ps eww`
- `set -x` or `bash -x` around the infra scripts
- `docker compose logs` piped anywhere except `explorer-proto/infra/scripts/leak_scan.mjs`
- writing the value to an `.env` file, an `--env-file`, a compose file, a log, test output or a commit

If a value or something that looks like one appears in your context, stop, do not repeat it, and tell the human. The licence check result is `PASS` or `FAIL` and nothing else.

## Stop conditions

Stop and report, with the exit code or file that shows it, when:

- the licence check is `FAIL` (a setup failure; never run another edition),
- a deterministic gate is `fail` or `blocked` and the only way forward would be to weaken it,
- the task is stale (`task_id` or a sha256 does not match), or your result was set aside (exit 21), or the agent-call, retry or time budget is exhausted (exit 22 or `budget_outcome`),
- the discovery budget ran out before the checkpoints held,
- a network containment violation or a guard error is reported,
- you would have to touch a path outside your role, or see something your role must not see,
- the next step needs a human decision (the points below).

## Human approval points

A person decides, and no agent substitutes:

1. Starting a live run (Docker, the stack, `MM_LICENSE` exported by the person).
2. Any download, by exact digest.
3. Any change under `explorer-proto/v2/gates/`, the policy, the schemas or the bakeoff files: an `approvals.json` entry bound to the combined hash, plus a lesson with `status: approved` and a human `approver` handle.
4. Approving a lesson. An agent proposes (`status: proposed`, `applied: false`, no approver).
5. Replacing a negative control that the server blocked, and adding to an oracle allowlist.
6. The bakeoff freeze, the repro set and every false-positive adjudication.
7. Pushing, opening a pull request or promoting a spec. `promote` writes a proposal only.

## Exit codes

Orchestrator: 0 done, 1 stage failed, 2 usage, 3 blocked, 20 awaiting an agent result, 21 result invalid or stale, 22 agent command failed on every attempt. An agent command exits 0 only after its result file is written and valid; any other exit counts as a failed attempt.
