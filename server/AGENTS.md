# AGENTS.md

Never run `go mod tidy` directly. Always run `make modules-tidy` instead — it excludes private enterprise imports that would otherwise break the tidy.

After editing `i18n/en.json`, always run `make i18n-extract` — it regenerates the file with strings in the required order.

Every entry in `i18n/en.json` carries a `description` explaining where the string appears and how it is used. It is context for translators, human or AI, and the one field a person is expected to write by hand: `make i18n-extract` preserves it, and a newly extracted id arrives with an empty one to fill in. The server never reads it — go-i18n parses only `id` and `translation` and discards the rest — so it is not worth stripping before release.

Add or change server strings only in `i18n/en.json`. `make i18n-extract` regenerates `en.json` alone; the other locale files come from the translation pipeline, so do not edit or regenerate them alongside feature work. `make i18n-verify` checks them against `en.json`.

Do not interpolate internal file-store or filesystem paths into error text shown to non-admin users. Keep that text generic and put the path in the error details or the log.

Prefer request-scoped loggers when logging from request paths. If a method needs to log and does not have access to the request logger, it is reasonable to add `request.CTX` to the method signature when the caller can provide it.
In the store layer, do not use `context.Context` in store method signatures. Use `request.CTX` and only call `rctx.Context()` inside internals that require a standard `context.Context`.

## Modules

`server/go.work` (gitignored, created by `make setup-go-work`, which the local `make` targets and CI run) resolves `github.com/mattermost/mattermost/server/public` to the local `server/public` directory. Read public types from `server/public`, not from the version pinned in `server/go.mod`. A new symbol in `server/public` needs no `replace` directive or version bump in `server/go.mod`.

## API layer (`channels/api4`)

- Do permission, ownership and request-precondition checks in the api4 handler before calling the app layer. App methods called from api4 assume the caller is already authorized; add a new endpoint's checks in the handler.
- `c.Params.Page` and `c.Params.PerPage` are parsed in `channels/web/params.go` before the handler runs: `Page` defaults to 0, and `PerPage` defaults to 60 and is capped at 200. Use them directly, without per-handler defaulting or clamping.
- A feature-flag check inside an `Init*` route-registration function runs once at startup, so enabling that flag needs a restart. Flags read inside a handler take effect at runtime. In tests, set route-gating flags through `SetupConfig`; flags read inside handlers can be changed with `th.App.UpdateConfig`.

## Tests

- In api4 tests, `SetupConfig(t, fn)` already calls `InitLogin`, which creates and logs in the system admin, system manager, team admin and basic users. Call `InitBasic` only when the test needs the basic team, channels or posts.
- Integration tests reach backing services (MinIO, Azurite, Postgres, LDAP, Inbucket) through `CI_*_HOST`/`CI_*_PORT` and default to localhost, as started by `make start-docker`. Follow that pattern; do not `t.Skip` when the variables are unset.
