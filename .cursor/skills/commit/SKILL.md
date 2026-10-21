---
name: commit
description: Create focused commits and pull requests following repository standards.
author: LIDR.co
version: 1.0.0
---
# commit Skill

Use it when this workflow is required in the project.

## Instructions

# Role

You are an expert in version control and release workflows. You create clear, comprehensive commits and Pull Requests that align with project standards and make review and traceability straightforward.

# Arguments

**Optional.** `$ARGUMENTS` may contain:

- **Nothing (empty)**: Stage and commit all relevant changes in the working tree, then open a single PR.
- **Feature/ticket identifiers**: e.g. ticket IDs (e.g. `SCRUM-123`), branch names, or short feature labels. When provided, stage and PR **only** the changes that belong to those features; leave all other changes unstaged and uncommitted.
- **Description-only / no-git mode**: If the user **explicitly** says something like "no PR", "only commit" (meaning only produce the commit text), "only description", "don't touch git", "just the message", or "dry run", then do **not** run any git commands or create a PR. Only determine scope, list what would be staged, and output the proposed commit message (subject + body). The user can copy and run git commands themselves.

# Goal

1. Produce a **single, comprehensive commit** that accurately describes the relevant changes.
2. **Push** the branch and **create (or update) a Pull Request** for review.
3. If arguments were given: **stage and commit only** the changes tied to those features; do not touch other modified files.

# Process and rules

## 0. Description-only / no-git mode (check first)

If the user **explicitly** requested no git operations (e.g. "no PR", "only commit", "only description", "don't touch git", "just the message", "dry run"):

- Perform **only** steps 1–3: inspect state, resolve scope (which files/hunks would be staged), and write the full commit message (subject + body).
- **Do not** run `git add`, `git commit`, `git push`, or `gh pr create`. Do not modify the repository in any way.
- Output for the user:
  1. List of files (and hunks, if partial) that would be staged.
  2. The proposed commit message in a copy-pasteable block.
- Then stop; skip steps 4, 5, and 6.

## 1. Inspect current state

- Run `git status` and `git diff` (and `git diff --staged` if needed) to list all modified, added, and deleted files.
- Identify the current branch. If not on a feature branch, decide whether to create one from the base branch (e.g. `main` or `develop`) before committing.

## 2. Resolve scope: full commit vs feature-scoped commit

- **If `$ARGUMENTS` is empty or not provided**  
  - Treat all relevant changes (excluding files that should not be committed, e.g. `.env`, build artifacts, local config) as the scope for this commit.  
  - Stage all of those and proceed to step 3.

- **If `$ARGUMENTS` is provided (e.g. ticket IDs or feature names)**  
  - Map each argument to the changes that clearly belong to it (by path, ticket id in branch name, or context in diffs).  
  - Stage **only** the files/hunks that belong to those features.  
  - Leave any other modified files **unstaged** and do not include them in the commit.  
  - If a file contains both feature-related and unrelated changes, use `git add -p` (or equivalent) to stage only the hunks that belong to the requested features.  
  - If no changes clearly match the given arguments, report this and do not commit.

## 3. Commit message

- Write the commit message **in English** (per `docs/base-standards.md`).
- Make it **descriptive** (per Git Workflow in `backend-standards.md` and `frontend-standards.md`).
- Structure it so that:
  - **Subject line**: Short, imperative summary (e.g. "Add candidate filters to position list", "Fix validation for application deadline"). Optionally prefix with a scope or ticket id (e.g. `SCRUM-123: Add candidate filters`).
  - **Body** (if needed): Bullet points or short paragraphs describing what changed and why (areas touched, new behavior, fixes). Reference ticket IDs here if they apply.
- Do not commit secrets, `.env`, or other sensitive or generated artifacts.

## 4. Commit and push

- Create the commit with the message from step 3.
- Push the current branch to the remote (`git push origin <branch>`). If the branch does not exist on the remote, push with `-u` to set upstream.

## 5. Pull Request

- Use the **GitHub CLI (`gh`)** for all GitHub operations (per repository standards).
- Create or update the PR for the current branch:
  - **Title**: Clear, aligned with the commit (e.g. include ticket ID if applicable: `[SCRUM-123] Add candidate filters to position list`).
  - **Description**: Summarize the change set, link to the ticket if relevant, and note any testing or follow-ups.
- If the repo uses branch protection or required checks, mention that the PR is ready for review once checks pass.

## 6. Summary for the user

- Report what was committed (files and scope).
- If arguments were provided: confirm which features/tickets were included and that other changes were left unstaged.
- Provide the PR URL (from `gh` output).

# References

- `docs/base-standards.md`: English-only for commit messages and technical artifacts.
- `docs/backend-standards.md` and `docs/frontend-standards.md`: Git Workflow (feature branches, descriptive commits, small focused branches).
- Repository git workflow conventions: Use `gh` for GitHub and PR creation; optional ticket-based branch and PR linking.

# Notes

- **Description-only**: When the user asks for no PR or only the commit text, output the staging plan and message only; do not run any git or `gh` commands.
- Do not run destructive git commands (e.g. `git push --force` without explicit user request).
- If there are conflicts or the push is rejected, report the situation and suggest next steps (e.g. pull/rebase then push), but do not force-push unless the user asks.
- When arguments are provided, **only** the changes tied to those features are staged and committed; everything else remains in the working tree for a separate commit or PR.
