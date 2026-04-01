# AGENTS.md

Never run `go mod tidy` directly. Always run `make modules-tidy` from the `server/` directory instead — it excludes private enterprise imports that would otherwise break the tidy.
