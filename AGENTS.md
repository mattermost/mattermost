# AGENTS.md

Explicitly import subdirectory instruction files that must always be in context:
@server/AGENTS.md

## Agentic QA (AMQA)

- Ingest CodeRabbit Change Impact from PR body; do not re-score risk when that block exists.
- 🟢 Low + "no manual QA required" → no verification work; respect `QA/skipped`.
- Execute CodeRabbit **QA Recommendation** steps for 🔴 High PRs; evidence in PR comment.
- Release confidence uses merge-time `qa-result` artifacts — see `.github/amqa/BASELINE.md`.
- Manual UI verification: use Cloud Agent `computerUse` per `.cursor/qa-playbook.md` and `.cursor/cursor.md` AMQA section.

## Pull Requests

When creating a pull request, follow `.github/PULL_REQUEST_TEMPLATE.md` exactly:

- Remove all `<!-- -->` comments.
- Omit sections that are not applicable (Ticket Link, Screenshots) — do not write N/A, just remove the header.
- The `#### Release Note` header and its "```release-note" fenced code block **must always be present** (WITHOUT escaping the ``` characters). Write `NONE` if the change has no API, schema, UI, or breaking changes.

## Cursor Cloud Agents

Cursor Cloud Agents must follow `.cursor/AGENTS.md`, materialized by `.cursor/scripts/cloud-agent-start.sh`.

