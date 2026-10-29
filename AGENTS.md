# AGENTS.md

Explicitly import subdirectory instruction files that must always be in context:
@server/AGENTS.md
@e2e-tests/playwright/AGENTS.md

## Pull Requests

When creating a pull request, follow `.github/PULL_REQUEST_TEMPLATE.md` exactly:

- Remove all `<!-- -->` comments.
- Omit sections that are not applicable (Ticket Link, Screenshots) — do not write N/A, just remove the header.
- The `#### Release Note` header and its "```release-note" fenced code block **must always be present** (WITHOUT escaping the ``` characters). Write `NONE` if the change has no API, schema, UI, or breaking changes.

## Cursor Cloud Agents

Cursor Cloud Agents must follow `.cursor/AGENTS.md`, materialized by `.cursor/scripts/cloud-agent-start.sh`.

## Access control (ABAC)

Permission checks live in server/channels/app/authorization.go, and the
handlers in server/channels/api4/ enforce them. Access control code also
lives in server/channels/app/access_control*.go, server/einterfaces/,
server/public/model/access_*.go and
webapp/platform/types/src/render_permissions.ts, and in any code that asks
for an access decision through AccessEvaluation.

Before you change any of it, read the ABAC rules in the enterprise repo,
checked out next to this one: ../enterprise/abac/rules/, or abac/rules/
under the BUILD_ENTERPRISE_DIR that server/config.override.mk sets. Each
rule's header lists the paths it covers. Follow every rule that covers
your change. No exceptions, however small the change.
