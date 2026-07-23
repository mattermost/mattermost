# AGENTS.md

Never run `go mod tidy` directly. Always run `make modules-tidy` instead — it excludes private enterprise imports that would otherwise break the tidy.

After editing `i18n/en.json`, always run `make i18n-extract` — it regenerates the file with strings in the required order.

Prefer request-scoped loggers when logging from request paths. If a method needs to log and does not have access to the request logger, it is reasonable to add `request.CTX` to the method signature when the caller can provide it.
