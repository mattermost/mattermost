# AGENTS.md

Never run `go mod tidy` directly. Always run `make modules-tidy` instead — it excludes private enterprise imports that would otherwise break the tidy.

After editing `i18n/en.json`, always run `make i18n-extract` — it regenerates the file with strings in the required order.

In the store layer, do not use `context.Context` in store method signatures. Use `request.CTX` and only call `rctx.Context()` inside internals that require a standard `context.Context`.
