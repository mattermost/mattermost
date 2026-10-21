# AGENTS.md

Explicitly import subdirectory instruction files that must always be in context:
@server/AGENTS.md

## Pull Requests

When creating a pull request, follow `.github/PULL_REQUEST_TEMPLATE.md` exactly:

- Remove all `<!-- -->` comments.
- Omit sections that are not applicable (Ticket Link, Screenshots) — do not write N/A, just remove the header.
- The `#### Release Note` header and its "```release-note" fenced code block **must always be present** (WITHOUT escaping the ``` characters). Write `NONE` if the change has no API, schema, UI, or breaking changes.

## Cursor Cloud Agents

Cursor Cloud Agents must follow `.cursor/AGENTS.md`, materialized by `.cursor/scripts/cloud-agent-start.sh`.

## Spec-driven development (OpenSpec + lidr-specboot)

Planned feature work uses Cursor commands in `.cursor/commands/`. Typical flow:

`/enrich-us` → `/ff` → `/apply` → `/verify` → `/adversarial-review` → `/archive` → `/commit`

Read `openspec/config.yaml` and `.cursor/rules/spec-driven-development.mdc` before creating artifacts. Keep Specboot standards in `lidr-specboot/`; do not overwrite Mattermost `docs/`.
