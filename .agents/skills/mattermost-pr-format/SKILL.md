---
name: mattermost-pr-format
description: Format Mattermost pull request descriptions to match the repo template. Use when creating or editing a PR, writing a PR body, formatting a release note, running gh pr create, or when the user asks to fix or align a PR description with Mattermost conventions.
---

# Mattermost PR formatting

Follow `.github/PULL_REQUEST_TEMPLATE.md` and root `AGENTS.md` Pull Requests section. Canonical template path: `.github/PULL_REQUEST_TEMPLATE.md`.

## Required structure

Always include these sections in order:

1. `#### Summary` — required
2. `#### Release Note` — required (with fenced `release-note` block)

Optional sections (include only when applicable):

- `#### Ticket Link`
- `#### Screenshots`

## Formatting rules

- Remove every HTML comment (`<!-- ... -->`) from the final PR body. Do not leave placeholder comments.
- Omit optional sections entirely when they do not apply. Do not write `N/A` or leave empty section headers.
- Keep `#### Release Note` and a real ` ```release-note ` fenced block in the output. Do not escape the triple backticks.
- If the change has no API, schema, user-visible, or breaking impact, the release note body is exactly `NONE` (inside the fence).
- Release notes use **past tense** when describing changes.
- Newlines inside the release-note block are stripped in automation; keep release notes to one or a few tight sentences.

## Section guidance

### Summary

- State what the PR does and why, in plain language.
- Include QA or test steps when the linked ticket does not cover verification.
- Bullet lists are fine for multi-part changes.

### Ticket Link

Include when there is a GitHub issue or Jira ticket:

```markdown
#### Ticket Link
Fixes https://github.com/mattermost/mattermost/issues/12345
```

Or Jira:

```markdown
#### Ticket Link
Fixes https://mattermost.atlassian.net/browse/MM-12345
```

### Screenshots

Use only for UI changes. Prefer before/after images or a short table:

```markdown
#### Screenshots
| before | after |
|--------|-------|
| ![before](url) | ![after](url) |
```

### Release Note

Write a release note when the PR includes any of:

- API or config changes
- Schema migrations (tables, columns, indexes, types)
- User-visible behavior (UI, CLI, websocket)
- Deprecations, breaking changes, or compatibility notes

The section must look like this (three backticks, language tag `release-note`, body, closing three backticks):

    #### Release Note
    ```release-note
    Added POST /api/v4/foo and GET /api/v4/foo/:foo_id.
    ```

For no user-visible or API impact, use `NONE` as the only line inside the fence.

Full copy-paste examples: `references/examples.md` in this skill directory.

## `gh pr create`

When using GitHub CLI, pass the formatted body via a HEREDOC so markdown and fences are preserved:

```bash
gh pr create --title "Your concise PR title" --body "$(cat <<'EOF'
<paste formatted body here>
EOF
)"
```

## Do not

- Use `webapp/channels/.github/PULL_REQUEST_TEMPLATE.md` for monorepo PRs unless the change is scoped only to that subtree and the team explicitly requests it.
- Drop the Release Note section or the `release-note` fence.
- Leave template instructional comments in the published PR body.
