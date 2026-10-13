# Working on this folder with agents

## Ground rules
- `README.md` is the source of truth for the definition. Other files are registers; keep IDs (`Bnn` for blockers, `Tnn` for tests) stable and never renumber.
- Every claim needs `file:line` evidence. Distinguish *code does X* from *we infer X*. Unrun scenarios stay `unknown` until a test or reproduction exists.
- Evidence paths are relative to `server/`; prefix `EE/` for the enterprise repo and `REPO/` for the monorepo root. Re-check line numbers before relying on them - code moves.
- Research agents are read-only on the code repos; they edit only this folder.
- Never mention customers by name at any point (docs, code comments, commit messages, PRs, agent output), and do not use customer codenames in these documents either. Refer to them generically (e.g. "a large customer"). If a source contains a real customer name, replace it with a generic description.
- Do not paste other customer-identifying data here; keep numbers from customers in the private channel.

## Useful agent tasks
| Task                                          | Prompt shape                                                                                          |
|-----------------------------------------------|-------------------------------------------------------------------------------------------------------|
| Re-verify a blocker                           | "Open the evidence for BNN. Is the claim true on current master? Update Status and correct evidence." |
| Migration audit (Migration safety workstream) | "Classify migrations 000150-000234 against the lock-safety rules; table of failing statements."       |
| Draft a test                                  | "Implement T03/T11 as a runnable harness; record baseline numbers."                                   |
| Intake                                        | "Turn Connor's answers into updates to ARCHITECTURES.md and QUESTIONS.md."                            |
| Completeness critic                           | "What is missing from BLOCKERS.md vs the README section 3.3 criteria?"                                |

## Status values
`open` -> `verified` -> `in-progress` -> `done`, or `refuted`. Record who and when.

## Refreshing
The initial review ran as 11 area investigators + a skeptic per area + a synthesis. Re-run an area after relevant merges rather than editing by memory.
