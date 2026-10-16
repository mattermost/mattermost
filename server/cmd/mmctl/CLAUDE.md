# mmctl Development Guide

## Tests
- Use `newTestCmd` to get a command for a handler test, passing the real package-level command var (e.g. `SystemNukeUsersCmd`, `SystemSetBusyCmd`). It resets context and flags to default on cleanup, so reused command vars don't leak state across tests/subtests, and you don't need to re-declare flags the command's `init()` already registers.
- Scope test fixtures to the narrowest test that needs them — a var used only by one test's subtests belongs at that test's scope, not package level.
- `RunForSystemAdminAndLocal`/`RunForAllClients` already call `printer.Clean()` per client subtest — don't repeat it as the first line of the closure.
