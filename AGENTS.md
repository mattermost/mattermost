# AGENTS.md

Never run `go mod tidy` directly. Always run `make modules-tidy` from the `server/` directory instead — it tidies all modules in the correct dependency order.
