# AGENTS.md

Never run `go mod tidy` directly. Always run `make modules-tidy` instead — it excludes private enterprise imports that would otherwise break the tidy.

After editing `i18n/en.json`, always run `make i18n-extract` — it regenerates the file with strings in the required order. Then run `make i18n-extract-authoring` to bring `i18n-authoring/en-with-description.json` back into lockstep, and fill in a description for any id it adds with an empty one.

Adding or changing a string is not finished there: its translations for all 21 non-English locales ship in the same pull request. The [repository translation guide](../i18n/AGENTS.md) has the workflow, the rules CI enforces, and the per-locale plural categories — note that the server's vendored go-i18n requires a different plural category set than current CLDR for `es`, `fr`, `it` and `pt-BR`.

Prefer request-scoped loggers when logging from request paths. If a method needs to log and does not have access to the request logger, it is reasonable to add `request.CTX` to the method signature when the caller can provide it.
In the store layer, do not use `context.Context` in store method signatures. Use `request.CTX` and only call `rctx.Context()` inside internals that require a standard `context.Context`.
