# AGENTS.md

Never run `go mod tidy` directly. Always run `make modules-tidy` instead — it excludes private enterprise imports that would otherwise break the tidy.

After editing `i18n/en.json`, always run `make i18n-extract` — it regenerates the file with strings in the required order. Then run `make i18n-extract-authoring` to bring `i18n-authoring/en-with-description.json` back into lockstep, and fill in a description for any id it adds with an empty one.
