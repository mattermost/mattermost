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

The environment declares `mattermost/enterprise` as a Cursor multi-repo dependency. Cursor clones the repositories as siblings, so `server/Makefile` can use its default `../../enterprise` path; the install hook does not clone or symlink enterprise.

### Before pushing webapp changes

Whenever `webapp/` is changed, run the related Jest suites locally and update tests/snapshots as needed before pushing. Prefer targeting affected packages/files (e.g. `cd webapp/channels && npm test -- --updateSnapshot <changed-test-files>`), then re-run without `-u` to confirm green. Do not push webapp changes with failing Jest or outdated snapshots.

### Before pushing Playwright / e2e changes

Do **not** push until locally verified:

1. `cd e2e-tests/playwright && npm run check` — **0 errors** (pre-existing warnings such as `no-warning-comments` TODOs or `max-lines` are OK).
2. Rebuild the playwright lib after `tsc` if needed (`npm run build`), then exercise affected specs **multiple times** (prefer 5×). When changes add client `data-testid`s, the server under test must serve this branch’s webapp (CI builds it; local testcontainers master image alone is not enough).
3. Only then commit, push, and create/update the PR.

### Playwright locator rules (especially POMs)

Follow Playwright’s [recommended built-in locators](https://playwright.dev/docs/locators#quick-guide). Prefer user-facing attributes; prioritize `getByRole`. Do **not** use CSS/XPath in POMs (e.g. `page.locator('.policy-name')`) — they are not resilient.

Recommended locators:

1. `getByRole()` — explicit/implicit accessibility attributes (prefer this)
2. `getByText()` — text content (use `{exact: true}` when names collide)
3. `getByLabel()` — form control by associated label text
4. `getByPlaceholder()` — input by placeholder
5. `getByAltText()` — usually images, by text alternative
6. `getByTitle()` — by `title` attribute
7. `getByTestId()` — by `data-testid` (last among built-ins; add a product test id when semantics are insufficient)

Put shared selectors on the POM via the locators above, not raw class strings in specs.
