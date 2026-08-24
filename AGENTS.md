# AGENTS.md

Explicitly import subdirectory instruction files that must always be in context:
@server/AGENTS.md

## Pull Requests

When creating a pull request, follow `.github/PULL_REQUEST_TEMPLATE.md` exactly:

- Remove all `<!-- -->` comments.
- Omit sections that are not applicable (Ticket Link, Screenshots) — do not write N/A, just remove the header.
- The `#### Release Note` header and its "```release-note" fenced code block **must always be present** (WITHOUT escaping the ``` characters). Write `NONE` if the change has no API, schema, UI, or breaking changes.

## Cursor Cloud Agents

This repository has a checked-in Cloud Agent environment under `.cursor/`. Docker is started by `.cursor/scripts/cloud-agent-start.sh`; if Docker is unavailable in Cloud, treat that as an environment failure rather than falling back to snapshot assumptions.

The environment declares `mattermost/enterprise` as a Cursor multi-repo dependency. When you select the multi-repo environment, Cursor clones the repositories as siblings so `server/Makefile` can use its default `../../enterprise` path. Git-triggered automations currently start in a single-repo layout; `repositoryDependencies` scopes the GitHub token but does not clone enterprise. In that case the install hook clones `mattermost/enterprise` next to this repo when the checkout is missing, or into `$HOME/enterprise` if that sibling path is not writable or is not a usable work tree, and writes `BUILD_ENTERPRISE_DIR` to `server/config.override.mk` for the fallback. `server/Makefile` reads that override before Enterprise detection so a documented `make run-server` still builds Enterprise Edition.

