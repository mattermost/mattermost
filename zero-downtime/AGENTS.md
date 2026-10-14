# Working on this folder with agents

## Ground rules
- `README.md` is the source of truth for the definition. `REGISTER.md` and `BLOCKERS.md` are registers. Keep IDs (`Bnn`, `Tnn`) stable and never renumber.
- Every claim needs `file:line` evidence. Separate "code does X" from "we infer X". Unrun scenarios stay `unknown` until a test or reproduction exists.
- Evidence paths are relative to `server/`. Prefix `EE/` for the enterprise repo and `REPO/` for the monorepo root. Re-check line numbers before relying on them.
- Research agents are read-only on the code repos. They edit only this folder.
- Never mention customers by name (docs, code comments, commits, PRs, agent output) and do not use customer codenames. Say "a large customer". Keep customer numbers in the private channel.

## Files
- `REGISTER.md`: one line per blocker, by tier. Update tier, owner and status here.
- `BLOCKERS.md`: evidence and remediation per blocker. Keep it in sync with the register.

## Useful agent tasks
| Task | Prompt shape |
|---|---|
| Re-verify a blocker | "Open the evidence for BNN. Is the claim true on current master? Update Status and correct evidence." |
| Migration audit | "Classify migrations 000150-000234 against the lock-safety rules; table of failing statements." |
| Draft a test | "Implement T01/T02 as a runnable harness; record baseline numbers." |
| Intake | "Turn Connor's answers into updates to README.md section 4 and PLAN.md." |
| Completeness critic | "What is missing from REGISTER.md vs the README section 2 criteria?" |

## Status values
`open` -> `verified` -> `in-progress` -> `done`, or `refuted`. Record who and when.

## Refreshing
Re-run an area's review after relevant merges instead of editing from memory.
