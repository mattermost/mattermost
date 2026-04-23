# Phase 0: Setup

**Worktree awareness**: When running inside a git worktree, use `git rev-parse --show-toplevel` for `repo.path`, prefer `~/.longshot/` for artifacts (worktrees may be cleaned up), and reuse the worktree's existing branch.

1. **Detect profile**: Check `--profile <name>` first, then auto-detect per [profiles.md](profiles.md)
2. **Feature name**: Kebab-case from input. If a Jira ticket is referenced, prefix: `MM-1234-<feature-name>`. Used for artifact directory and branch.
3. **Branch**: Create from HEAD if not on a feature branch; reuse if already on one. Override with `--branch <name>`. Default naming: `MM-1234-<name>` when a ticket is referenced (preferred). Without a ticket, infer prefix from work type: `feat/<name>` for features, `fix/<name>` for bug fixes, `poc/<name>` for experiments, `refactor/<name>` for refactors, `chore/<name>` otherwise.
4. **Create artifact directory** matching the feature name (ticket-prefixed when available). Resolve storage in order:
   1. `~/.longshot/<feature>/` (default — try `mkdir -p ~/.longshot/`)
   2. `.longshot/<feature>/` in repo root (fallback; add to `.gitignore`)
   3. PR-embedded — emit `spec.md`/`plan.md` into the PR body, serialize `state.json` as a JSON block per phase

   Store the resolved path in `state.json.artifact_dir`.

   ```text
   <artifact_dir>/
   ├── state.json
   ├── spec.md              # Phase 1
   ├── plan.md              # Phase 2
   └── findings/            # swarm-mode review output
   ```
5. **Initialize state.json** (RFC3339 UTC timestamps per [rules.md §1.2](rules.md#12-timestamp-format)).

   **Concurrent run guard**: If `state.json` exists with `"status": "in_progress"`, warn: "Active run exists. Use `--force` to overwrite, or `--skip-to` to resume." Require `--force` to proceed.

   ```json
   {
     "feature": "<feature-name>",
     "recap": "<1-2 sentence summary of the run: what it's doing and why>",
     "profile": "<resolved profile name>",
     "flags": {
       "skip": ["<phase>", "..."],
       "refs": ["<token>", "..."],
       "minimal": false,
       "solo": false,
       "triage": false,
       "ideate": false
     },
     "status": "in_progress",
     "artifact_dir": "<resolved path: ~/.longshot/<feature> or .longshot/<feature> or null if PR-embedded>",
     "repo": {
       "path": "<absolute path to repo root, from git rev-parse --show-toplevel>",
       "remote": "<origin remote URL, from git remote get-url origin>",
       "branch": "<feature-name>",
       "base_branch": "<branch branched from, e.g. main>",
       "is_worktree": false
     },
     "current_phase": 0,
     "current_task": null,
     "phases": {
       "0-setup": {"status": "complete", "timestamp": "2026-03-19T14:32:45Z"},
       "1-requirements": {"status": "pending"},
       "2-plan": {"status": "pending"},
       "3-implement": {"status": "pending"},
       "4-test": {"status": "pending"},
       "5-quality": {"status": "pending"},
       "6-review": {"status": "pending"},
       "7-ship": {"status": "pending"},
       "8-release": {"status": "pending"}
     },
     "commits": [],
     "checkpoints": [],
     "security": {
       "is_security_issue": false,
       "ticket_type": null,
       "severity": null,
       "cve": null,
       "embargo_until": null
     },
     "release": {
       "fix_version": null,
       "backport_targets": [],
       "cherry_pick_prs": []
     },
     "created": "2026-03-19T14:32:45Z",
     "updated": "2026-03-19T14:32:45Z"
   }
   ```
6. **Permission surface** (reference for platform settings/allowlist configuration — e.g., `.claude/settings.json` on Claude Code):
   - All profiles: `git`, `Read`/`Write`/`Edit`/`Glob`/`Grep`, `Agent`, `WebFetch`, `acli jira workitem view`, `gh pr create`, `Bash: mkdir/ls/jq`
   - Mattermost: `make check-style`/`test-server`/`fmt`/`i18n-extract` (server), `make check-style`/`check-types`/`fix-style`/`test` (webapp), `npm audit`, `npx playwright test`
   - Mobile: `npm install`/`lint`/`check-types`/`test`
   - Playbooks: `make deploy`/`check-style`/`i18n-extract`
   - Generic: auto-detected from `package.json` / `Makefile` / `go.mod`

7. **Toolchain probe**: Verify CLIs for the detected profile.

   | Tool | Check | Missing behavior |
   |------|-------|-----------------|
   | `git` | `git --version` | ABORT — pipeline cannot run |
   | `gh` | `gh --version` | Warn — Phase 7 PR creation will fail; suggest `--skip pr` |
   | `acli` | `acli --version` | Warn — Jira/Confluence steps (Phase 1, 8) fall back to Atlassian MCP, then manual prompts |
   | `make` | `make --version` | Warn (MM only) — Phases 4-5 quality commands may fail |
   | `npm` / `go` | check in `$PATH` | Warn — profile-specific test/lint commands may fail |

   Print a summary: `Tools: git ✓  gh ✓  acli ✓  make ✓  npm ✓` (or ✗ for missing). If any non-critical tool is missing, note which phases will degrade. If `git` is missing, abort with instructions.

8. **Detect execution mode**: Check if the `TeamCreate` tool is available. If yes → swarm mode. If no → solo mode. Override with `--solo`.

9. **Report**: Print detected profile, branch name, execution mode (swarm/solo), and phase plan

**Flag behaviors**:
- `--continue` / `--resume`: read state.json, pick up at `current_phase`, re-read spec.md/plan.md
- `--skip-to <phase>`: jump to a specific phase (e.g., after manual edits)
- `--status`: print phase breakdown, current task, commit count, next step
- `--validate`: spawn a validator agent to check state.json consistency and artifact integrity
- `--dry-run`: print the phase plan with profile commands and stop

---

## Minimal Phase 0 for `--only`

`/longshot --only <phase>[,<phase>...]` runs a reduced Phase 0 first to guarantee `artifact_dir`. Skips branch creation, permission approvals, and spec/plan drafting.

Runs: profile detection, toolchain probe, execution mode, state.json resolution. If state.json exists, reuse its `artifact_dir`. Otherwise bootstrap with feature name `<branch>-<first-phase>-<RFC3339>`, resolve path per full Phase 0's step 4, and write `state.json` with `recap: "--only <phases> invocation"`, `status: "in_progress"`, `current_phase: <first>`, and `flags.only: ["<phase>", ...]` preserving the order given on the CLI. Print the resolved path.

**Multi-phase execution** (`--only review,test` or similar):
- Parse comma-separated list into an ordered queue; preserve CLI order verbatim (no topological re-sorting). If the user wrote `--only test,review`, run test before review.
- Execute each phase in turn, honoring its normal gates and retry budgets ([rules.md §4](rules.md#4-retry--escalation-budgets)). A gate failure in one phase STOPs the run — do not silently skip to the next.
- Between phases, update `state.json.current_phase` and emit a one-line transition log; do NOT run interstitial phases that weren't listed (e.g., `--only review,test` does not invoke quality between them).
- On completion, exit without triggering downstream phases (same as single-phase `--only`).
- Duplicates are collapsed preserving first occurrence. Unknown tokens abort before execution with the list of valid phase names.

STOP if `git` unavailable or no writable filesystem.

---

## Execution Modes

| Mode | Detection | Parallelism |
|------|-----------|-------------|
| Swarm (default) | `TeamCreate` available | Agent teams per phase, up to 3 convergence rounds |
| Solo | `--solo` or no `TeamCreate` | Serial subagent calls, single-pass |

| Phase | Team | Agents |
|-------|------|--------|
| 2 Plan | `longshot-plan` | researcher, domain advisors, drafter, checker |
| 3 Implement | `longshot-impl` | layer coders, reviewers |
| 4 Test | `longshot-test` | backend/frontend/e2e writers, fixer |
| 6 Review | `longshot-review` | tier-based review agents |

Swarm discipline (file ownership, findings layout, interface broadcasts, convergence) in [rules.md §7](rules.md#7-swarm-mode-file-ownership--convergence). Retry budgets in [rules.md §4](rules.md#4-retry--escalation-budgets).
