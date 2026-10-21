---
name: using-git-worktrees
description: Use when starting feature work that needs isolation from current workspace or before executing implementation plans - ensures an isolated workspace exists via native tools or git worktree fallback
author: LIDR.co
version: 1.0.0
---

# Using Git Worktrees

## Overview

Ensure work happens in an isolated workspace. Prefer your platform's native worktree tools. Fall back to manual git worktrees only when no native tool is available.

**Core principle:** Detect existing isolation first. Then use native tools. Then fall back to git. Never fight the harness.

**Announce at start:** "I'm using the using-git-worktrees skill to set up an isolated workspace."

## Step 0: Detect Existing Isolation

**Before creating anything, check if you are already in an isolated workspace.**

```bash
GIT_DIR=$(cd "$(git rev-parse --git-dir)" 2>/dev/null && pwd -P)
GIT_COMMON=$(cd "$(git rev-parse --git-common-dir)" 2>/dev/null && pwd -P)
BRANCH=$(git branch --show-current)
```

**Submodule guard:** `GIT_DIR != GIT_COMMON` is also true inside git submodules. Before concluding "already in a worktree," verify you are not in a submodule:

```bash
# If this returns a path, you're in a submodule, not a worktree — treat as normal repo
git rev-parse --show-superproject-working-tree 2>/dev/null
```

**If `GIT_DIR != GIT_COMMON` (and not a submodule):** You are already in a linked worktree. Skip to Step 3 (Project Setup). Do NOT create another worktree.

Report with branch state:
- On a branch: "Already in isolated workspace at `<path>` on branch `<name>`."
- Detached HEAD: "Already in isolated workspace at `<path>` (detached HEAD, externally managed). Branch creation needed at finish time."

**If `GIT_DIR == GIT_COMMON` (or in a submodule):** You are in a normal repo checkout.

Has the user already indicated their worktree preference in your instructions? If not, ask for consent before creating a worktree:

> "Would you like me to set up an isolated worktree? It protects your current branch from changes."

Honor any existing declared preference without asking. If the user declines consent, work in place and skip to Step 3.

## Step 1: Create Isolated Workspace

**You have two mechanisms. Try them in this order.**

### 1a. Native Worktree Tools (preferred)

The user has asked for an isolated workspace (Step 0 consent). Do you already have a way to create a worktree? It might be a tool with a name like `EnterWorktree`, `WorktreeCreate`, a `/worktree` command, or a `--worktree` flag. If you do, use it and skip to Step 3.

Native tools handle directory placement, branch creation, and cleanup automatically. Using `git worktree add` when you have a native tool creates phantom state your harness can't see or manage.

If the native flow does not propagate Claude/Cursor settings and the user expects parity with the main checkout, copy `.claude/settings.json` and `.claude/settings.local.json` from the primary workspace using the same loop as Step 1b **after** the native tool finishes—only when files exist on disk.

Only proceed to Step 1b if you have no native worktree tool available.

### 1b. Git Worktree Fallback

**Only use this if Step 1a does not apply** — you have no native worktree tool available. Create a worktree manually using git.

#### Directory Selection

Use a single location: `.worktrees/` inside the repository root.

1. Set the repository root and worktree base directory:
   ```bash
   SOURCE_ROOT=$(git rev-parse --show-toplevel)
   LOCATION="$SOURCE_ROOT/.worktrees"
   ```

2. Ensure the directory exists:
   ```bash
   mkdir -p "$LOCATION"
   ```

3. Always create the worktree at:
   ```bash
   path="$LOCATION/$BRANCH_NAME"
   ```

No global/sibling alternatives should be used unless the user explicitly overrides this rule for a one-off task.

#### Safety Verification

**MUST verify `.worktrees/` is ignored before creating worktree:**

```bash
git check-ignore -q .worktrees 2>/dev/null
```

**If NOT ignored:** Add `.worktrees/` to `.gitignore`, commit the change, then proceed.

**Why critical:** Prevents accidentally committing worktree contents to repository.

#### Create the Worktree

**Capture the main checkout root before `git worktree add`.** After `cd` into the new worktree, `git rev-parse --show-toplevel` points at the worktree directory, not the checkout where `.claude/settings*.json` usually lives.

```bash
project=$(basename "$(git rev-parse --show-toplevel)")
SOURCE_ROOT=$(git rev-parse --show-toplevel)

# Path is always inside repo-local .worktrees/
path="$LOCATION/$BRANCH_NAME"

git worktree add "$path" -b "$BRANCH_NAME"
cd "$path"
```

**Sandbox fallback:** If `git worktree add` fails with a permission error (sandbox denial), tell the user the sandbox blocked worktree creation and you're working in the current directory instead. Then run setup and baseline tests in place.

#### Copy Claude configuration (Step 1b only)

After creating the worktree with git (Step 1b), copy local Claude settings from the **main checkout** so Cursor/Claude CLI behavior matches the primary workspace. These files are often untracked.

Do **not** copy if the user declines or if a native tool (Step 1a) already propagates settings—respect the harness.

Run **after** `cd "$path"` (still using `SOURCE_ROOT` captured above):

```bash
copied_claude_settings=false
for claude_settings in ".claude/settings.json" ".claude/settings.local.json"; do
    if [ -f "$SOURCE_ROOT/$claude_settings" ]; then
        mkdir -p ".claude"
        cp -p "$SOURCE_ROOT/$claude_settings" "./$claude_settings"
        echo "Copied $claude_settings to worktree"
        copied_claude_settings=true
    fi
done

if [ "$copied_claude_settings" = false ]; then
    echo "No local Claude settings found (.claude/settings.json or .claude/settings.local.json)"
fi
```

**Symlinks:** If the source tree uses symlinks for `.claude` (e.g. `.claude/skills` → `../../ai-specs/skills`), copying only these JSON files does not recreate symlink targets. Either repeat the same symlink layout in the worktree or rely on project-relative paths inside `settings.json`.

## Step 3: Project Setup

Auto-detect and run appropriate setup:

```bash
# Node.js
if [ -f package.json ]; then npm install; fi

# Rust
if [ -f Cargo.toml ]; then cargo build; fi

# Python
if [ -f requirements.txt ]; then pip install -r requirements.txt; fi
if [ -f pyproject.toml ]; then poetry install; fi

# Go
if [ -f go.mod ]; then go mod download; fi
```

## Step 4: Verify Clean Baseline

Run tests to ensure workspace starts clean:

```bash
# Use project-appropriate command
npm test / cargo test / pytest / go test ./...
```

**If tests fail:** Report failures, ask whether to proceed or investigate.

**If tests pass:** Report ready.

### Report

```
Worktree ready at <full-path>
Claude settings copied (or none found / skipped per harness)
Tests passing (<N> tests, 0 failures)
Ready to implement <feature-name>
```

## Step 5: Cleanup — Remove the Worktree When Done

**Run cleanup once the work is complete.** "Done" means: branch merged, PR closed, the experiment was discarded, or the user has explicitly confirmed they no longer need the isolated workspace. Never remove a worktree that still contains uncommitted, unpushed, or unmerged changes the user may want.

### 5.0 Detect Cleanup Mode

```bash
GIT_DIR=$(cd "$(git rev-parse --git-dir)" 2>/dev/null && pwd -P)
GIT_COMMON=$(cd "$(git rev-parse --git-common-dir)" 2>/dev/null && pwd -P)
```

- **If `GIT_DIR == GIT_COMMON`:** You were never in a linked worktree (Step 0 sent you straight to Step 3). There is nothing to clean up — skip Step 5 entirely.
- **If `GIT_DIR != GIT_COMMON`:** You are inside a linked worktree. Continue with cleanup.

### 5.1 Verify Work Is Saved

Before removing anything, confirm there is no work to lose:

```bash
git status --porcelain                 # Must be empty (no uncommitted changes)
git log @{u}.. 2>/dev/null             # Must be empty (no unpushed commits)
```

**If either command returns output:** Stop. Report the unsaved work to the user and ask how to proceed (commit/push, stash, or force discard). Never delete a worktree with unsaved work without explicit user confirmation.

Capture the worktree path and branch name before leaving the directory:

```bash
WORKTREE_PATH=$(git rev-parse --show-toplevel)
BRANCH_NAME=$(git branch --show-current)
```

### 5.2 Native Worktree Tools (preferred)

If you used a native worktree tool in Step 1a (`EnterWorktree`, `WorktreeCreate`, `/worktree`, etc.), use the matching native command to remove the worktree (e.g. `LeaveWorktree`, `WorktreeRemove`, `/worktree remove`). Native tools clean up directories, branches, and harness state consistently.

Only proceed to 5.3 if no native cleanup tool is available.

### 5.3 Git Worktree Fallback Cleanup

**Only use this if Step 5.2 does not apply** — you created the worktree manually in Step 1b.

```bash
# 1. Move out of the worktree before deleting it
cd "$GIT_COMMON/.."   # or any path inside the main checkout

# 2. Remove the worktree
git worktree remove "$WORKTREE_PATH"

# 3. If files are still present (e.g. ignored artifacts blocking removal),
#    confirm with the user, then force-remove
git worktree remove --force "$WORKTREE_PATH"

# 4. Delete the local branch only if it was created for this worktree
#    AND has been merged or is no longer needed
git branch -d "$BRANCH_NAME"            # safe delete (refuses if unmerged)
git branch -D "$BRANCH_NAME"            # force delete (only with user confirmation)

# 5. Prune stale worktree metadata if the directory was deleted manually
git worktree prune
```

**Sandbox fallback:** If removal fails due to permissions, report the failure and the path that needs manual cleanup. Do not retry destructively.

### 5.4 Verify Cleanup

```bash
git worktree list                      # WORKTREE_PATH must no longer appear
ls -d "$WORKTREE_PATH" 2>/dev/null     # Must return nothing
```

### Report

```
Worktree removed: <full-path>
Branch <name> deleted (or kept, if still needed)
Main checkout left untouched
```

## Quick Reference

| Situation | Action |
|-----------|--------|
| Already in linked worktree | Skip creation (Step 0) |
| In a submodule | Treat as normal repo (Step 0 guard) |
| Native worktree tool available | Use it (Step 1a) |
| No native tool | Git worktree fallback (Step 1b) |
| Need a worktree location | Use `<repo>/.worktrees/<branch>` |
| Directory not ignored | Add to .gitignore + commit |
| Permission error on create | Sandbox fallback, work in place |
| Tests fail during baseline | Report failures + ask |
| No package.json/Cargo.toml | Skip dependency install |
| Work complete, in linked worktree | Run Step 5 cleanup |
| Never created a worktree | Skip Step 5 |
| Uncommitted/unpushed changes at cleanup | Stop and ask user |
| Native cleanup tool available | Use it (Step 5.2) |
| No native cleanup tool | `git worktree remove` (Step 5.3) |
| Worktree directory deleted manually | `git worktree prune` |
| Git fallback: clone Claude behavior into worktree | Copy `.claude/settings*.json` from `SOURCE_ROOT` (Step 1b) |
| Repo uses `.claude` symlinks | Copy JSON only is not enough—recreate symlinks or paths |

## Common Mistakes

### Fighting the harness

- **Problem:** Using `git worktree add` when the platform already provides isolation
- **Fix:** Step 0 detects existing isolation. Step 1a defers to native tools.

### Skipping detection

- **Problem:** Creating a nested worktree inside an existing one
- **Fix:** Always run Step 0 before creating anything

### Skipping ignore verification

- **Problem:** Worktree contents get tracked, pollute git status
- **Fix:** Always use `git check-ignore` before creating project-local worktree

### Assuming directory location

- **Problem:** Creates inconsistency, violates project conventions
- **Fix:** Always use `<repo>/.worktrees/<branch>` unless user explicitly overrides for one task

### Proceeding with failing tests

- **Problem:** Can't distinguish new bugs from pre-existing issues
- **Fix:** Report failures, get explicit permission to proceed

### Removing a worktree with unsaved work

- **Problem:** `git worktree remove --force` discards uncommitted/unpushed changes silently
- **Fix:** Always run `git status --porcelain` and `git log @{u}..` before removal; stop and ask if either is non-empty

### Deleting the branch before it is merged

- **Problem:** `git branch -D` destroys commits that were never merged or pushed
- **Fix:** Prefer `git branch -d` (safe delete); only force-delete after explicit user confirmation

### Mixing native and manual cleanup

- **Problem:** Running `git worktree remove` on a worktree created by a native tool leaves phantom harness state
- **Fix:** Whatever created the worktree must remove it (native tool ↔ native tool, git ↔ git)

### Copying Claude settings from the wrong directory

- **Problem:** Using `git rev-parse --show-toplevel` after `cd` into the new worktree resolves to the worktree path, so copies find no settings or copy from the wrong place
- **Fix:** Set `SOURCE_ROOT=$(git rev-parse --show-toplevel)` in the main checkout **before** `git worktree add`, then use `$SOURCE_ROOT` in the copy loop

## Red Flags

**Never:**
- Create a worktree when Step 0 detects existing isolation
- Use `git worktree add` when you have a native worktree tool (e.g., `EnterWorktree`). This is the #1 mistake — if you have it, use it.
- Skip Step 1a by jumping straight to Step 1b's git commands
- Create worktree without verifying it's ignored (project-local)
- Skip baseline test verification
- Proceed with failing tests without asking
- Remove a worktree that still has uncommitted, unpushed, or unmerged work without explicit user confirmation
- Force-delete a branch (`git branch -D`) without confirming it is merged or no longer needed
- Run `git worktree remove` on a worktree created by a native tool

**Always:**
- Run Step 0 detection first
- Prefer native tools over git fallback
- Use `<repo>/.worktrees/<branch>` as the standard location
- Verify directory is ignored for project-local
- Auto-detect and run project setup
- Verify clean test baseline
- Run Step 5 cleanup once the work is done, using the same mechanism that created the worktree
- Verify there is nothing to lose before removing a worktree (`git status --porcelain`, `git log @{u}..`)
- Confirm with `git worktree list` and a directory check that cleanup actually completed
- After Step 1b (git fallback), copy `.claude/settings.json` and `.claude/settings.local.json` from `SOURCE_ROOT` captured before `git worktree add`
