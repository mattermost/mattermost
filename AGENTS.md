# AGENTS.md

Explicitly import subdirectory instruction files that must always be in context:
@server/AGENTS.md
@e2e-tests/playwright/AGENTS.md

## Pull Requests

When creating a pull request, follow `.github/PULL_REQUEST_TEMPLATE.md` exactly:

- Remove all `<!-- -->` comments.
- Omit sections that are not applicable (Ticket Link, Screenshots) — do not write N/A, just remove the header.
- The `#### Release Note` header and its "```release-note" fenced code block **must always be present** (WITHOUT escaping the ``` characters). Write `NONE` if the change has no API, schema, UI, or breaking changes.

## Responding to review bots (CodeRabbit, Bugbot)

- Before fixing any finding, verify it against the code: read the callee, check
  whether the behavior is already handled, and confirm the PR's diff introduces
  or worsens it.
- Fix a Critical or Major finding once you have confirmed it is real. If it is
  wrong, or the diff neither introduces nor worsens it, reply with the reason
  instead. Don't dismiss a finding only because the underlying failure predates
  the PR: if the diff makes it worse, it counts.
- Fix a Minor finding only if it is a defect someone would hit: wrong behavior,
  a security or privacy gap, data loss, a crash or hang, a realistic race, a
  flaky or falsely passing test, a docs command that fails, a wrong fact, or a
  control unusable by keyboard or screen reader.
- For any other Minor finding (wording, typos, qualifying accurate text, extra
  assertions, defensive checks for inputs that won't occur, refactors), do not
  change code. Reply once: "Skipping: nit, no user impact."
- Batch all review fixes into one commit per review round.
- Never argue with the bot to create a learning; leave design disagreements for
  a human.
- If CodeRabbit says "Reviews paused", comment `@coderabbitai resume`. If findings
  are fixed but it still requests changes, comment `@coderabbitai resolve`.
  Use `@coderabbitai review` only for new commits it has not reviewed.

| Situation | Command |
| --- | --- |
| A notice says "Reviews paused" | `@coderabbitai resume` |
| New commits, not paused, no review after 20 minutes | `@coderabbitai review` |
| Findings fixed, but CodeRabbit still requests changes | `@coderabbitai resolve` |

## Cursor Cloud Agents

Cursor Cloud Agents must follow `.cursor/AGENTS.md`, materialized by `.cursor/scripts/cloud-agent-start.sh`.

