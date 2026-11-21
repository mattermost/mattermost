# Changing the gates or the promotion policy

The gates in this directory are the frozen, human-approved checks of pilot v2. Agents plan and judge; these modules
decide. Nothing here may be loosened, bypassed or extended by an agent.

## What is covered

Every file under `explorer-proto/v2/gates/` is covered, except `approvals.json` (it records approvals of a hash) and
`README.md` (documentation). That includes the gate modules, `promotion_policy.json`, `POLICY-CHANGE.md`, the self-tests
and all fixtures. `policy_hash.mjs` prints the sha256 of each file and a combined hash.

## Rules

1. **A gate change needs a recorded human approval.** A change is any edit, addition or removal of a covered file. An
   approval is an entry in `approvals.json`: `{"combined_sha256": "<hash printed by policy_hash.mjs>", "approved_by":
"<handle>", "scope": "<one line>"}`. The handle must be a non-empty human handle. `lessons_guard.mjs` and
   `policy_hash.mjs --check-approval` refuse handles that name an agent, bot, model, CI or orchestrator.
2. **The approval is bound to a hash, not to a person's intent.** Any later edit changes the combined hash and makes the
   approval stale. A stale approval approves nothing.
3. **Agents and the orchestrator never write this directory.** A lesson that proposes a change under
   `explorer-proto/v2/gates/`, to `promotion_policy.json`, to the bakeoff rules or protocol, or to the schemas is refused
   by `lessons_guard.mjs` unless it is `approved` with a human `approver`. Approval of the lesson is not approval of the
   resulting diff: the diff still needs its own `approvals.json` entry.
4. **No thresholds move to fit a result.** Relaxing a gate, the flake budget or the stability window after seeing a
   failing run is not allowed. A change must state the earlier lesson or defect it answers in `scope`.
5. **A freeze pins the hashes.** `bakeoff/freeze.mjs` hashes `explorer-proto/v2/gates/*`. Run
   `node explorer-proto/v2/gates/policy_hash.mjs > pin.json` when freezing, and `policy_hash.mjs --verify pin.json`
   before every run: exit 1 lists changed, added and removed files. A change after a freeze means a new freeze and a
   new, separately reported bakeoff.
6. **No bypass.** No gate reads an environment variable or flag that turns a check off. If a check blocks legitimate
   work, change the gate under rules 1 to 5.
7. **Agent verdicts cannot override gate failures.** The policy says so (`agent_verdict_override.allowed: false`) and
   `promote_decision.mjs` refuses a policy that does not. Supply every gate module's raw output with `--gate-result`
   so the decision does not rest on the verdict alone.

## Procedure

```bash
# 1. Change the files, then prove the gates still catch their bad inputs.
node explorer-proto/v2/gates/selftest.mjs

# 2. Print the new hashes and review the diff.
node explorer-proto/v2/gates/policy_hash.mjs --text

# 3. A human adds an entry to approvals.json with the combined hash and commits it.
node explorer-proto/v2/gates/policy_hash.mjs --check-approval   # exit 0 only if that hash is approved
```

## State of this version

`approvals.json` is empty. This version of the gates has not been approved by a human. Until an entry with the
current combined hash exists, `policy_hash.mjs --check-approval` exits 1 and the gates must not be treated as frozen.
