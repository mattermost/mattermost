---
name: mattermost-pull-request
description: Create Mattermost pull requests using the repository template. Use when creating a pull request, drafting a PR body, or preparing a PR for this Mattermost repository.
---

# Mattermost Pull Request

## Instructions

When creating or drafting a pull request for this repository:

1. Use `.github/PULL_REQUEST_TEMPLATE.md` exactly as the source template.
2. Remove all `<!-- -->` comments.
3. Omit sections that are not applicable, including `Ticket Link` and `Screenshots`; do not write `N/A`, just remove the header.
4. Always include the `#### Release Note` header and its fenced `release-note` code block without escaping the backticks.
5. Write `NONE` in the release-note block if the change has no API, schema, UI, or breaking changes.
