# AGENTS.md

## enterprise.pin

`enterprise.pin` records the enterprise commit SHA that this server branch is tested against. It keeps server and enterprise branches in sync across CI and local development.

**During development of an enterprise feature:** manually set `enterprise.pin` to the HEAD commit of your corresponding enterprise feature branch. This ensures CI tests this server branch against the correct enterprise code.

**After the enterprise pull request is merged:** update the pin to the enterprise repository HEAD by running:

```bash
cd server && make bump-enterprise
```

This requires the enterprise directory to be present (configured via `BUILD_ENTERPRISE_DIR`). Commit the updated `enterprise.pin` as part of your server pull request.

## Pull Requests

When creating a pull request, follow `.github/PULL_REQUEST_TEMPLATE.md`.
