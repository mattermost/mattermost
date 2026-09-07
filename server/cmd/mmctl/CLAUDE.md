# mmctl Development Guide

## Tests
- Shared package-level command vars (e.g. `SystemNukeUsersCmd`, `SystemSetBusyCmd`) leak state across tests/subtests when reused. When a test helper binds one, use `t.Cleanup` to reset both `cmd.Context()` and every flag back to its default (`f.Value.Set(f.DefValue)`, `f.Changed = false`).
- Don't re-declare flags in tests that duplicate what a command's `init()` already registers (e.g. `output-file`, `confirm`, `seconds`). Bind the real command var instead of redeclaring flags on a bare `cobra.Command`.
- Scope test fixtures to the narrowest test that needs them — a var used only by one test's subtests belongs at that test's scope, not package level.
