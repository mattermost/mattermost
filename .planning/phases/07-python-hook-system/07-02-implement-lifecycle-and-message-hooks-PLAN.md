# Phase 7 — Python Hook System
## Plan 07-02: Implement lifecycle + message hooks (Python gRPC hook servicer)

<objective>
Implement the Python gRPC hook servicer methods for the most critical hooks:
- Lifecycle hooks: `OnActivate`, `OnDeactivate`, `OnConfigurationChange`, `Implemented`
- Message hooks: `MessageWillBePosted`, `MessageWillBeUpdated`, `MessageHasBeenPosted`, `MessageHasBeenUpdated`, `MessageHasBeenDeleted`, `MessagesWillBeConsumed`

This plan wires protobuf request/response types to Python plugin handler methods, including correct return semantics and error behavior.
</objective>

<execution_context>
- Repo root: `mattermost-python-in-plugins/`
- Phase: 7 (Python Hook System)
- Plan: 07-02
- Depends on:
  - Phase 07-01 output: hook registry + server bootstrap modules exist in `python-sdk/src/mattermost_plugin/`
  - Phase 3 output: `hooks.proto` exists and defines RPCs for these hooks
  - Phase 1 output: core types (Context, Post, etc.) exist in protobuf (via `plugin.proto` or imported protos)
- Primary references:
  - `server/public/plugin/hooks.go` (authoritative semantics + signatures)
  - `server/public/plugin/client_rpc.go` (how hook RPC failures are handled today: generally log + default)
  - `.planning/phases/07-python-hook-system/07-RESEARCH.md` (timeouts, error patterns)
</execution_context>

<context>
- **Canonical semantics (Go):**
  - `OnActivate() error`: non-nil error prevents activation and terminates plugin.
  - `OnConfigurationChange() error`: error is logged but plugin continues (must fail gracefully).
  - `MessageWillBePosted(...) (*Post, string)`:
    - reject: return non-empty string
    - modify: return non-nil post + empty string
    - allow: return nil post + empty string
    - dismiss: return nil post + `DismissPostError` (see `server/public/plugin/hooks.go`)
- **RPC failure behavior (Go today):**
  - When calling hooks via net/rpc, errors are logged and the server generally falls back to a safe default (fail-open). See patterns in `server/public/plugin/client_rpc.go`.
- **Python constraints:**
  - gRPC servicer methods should be async (`grpc.aio`).
  - Plugin handler may be sync or async; use the hook runner from 07-01 with timeout.
</context>

<tasks>
### Mandatory discovery (Level 0 → 2)
- [ ] **Confirm generated hook service API**:
  - Locate the generated Python servicer base class (e.g., `hooks_pb2_grpc.PluginHooksServicer`).
  - Enumerate the exact RPC names + request/response message types for hooks in this plan.
- [ ] **Confirm type conversion strategy**:
  - Identify which Python “public” wrapper types exist from Phase 6 for `Post`, `User`, etc.
  - Decide per-hook whether plugin handlers receive:
    - wrappers (preferred) OR
    - raw protobuf messages (acceptable for first implementation if wrappers are missing)
  - Lock down the choice in one place (no per-hook ad hoc types).
- [ ] **Decide error transport rules** (write them down in the servicer module docstring):
  - For *plugin bugs* (exceptions): return gRPC `INTERNAL` (Go side should log and default/fail-open where appropriate).
  - For *expected “business rejections”* (e.g., post rejected): encode via response fields (not gRPC error).
  - For *OnActivate error*: decide whether to encode as response field or gRPC error; match what the Go-side client expects.

### Implement the servicer skeleton
- [ ] **Create/extend hook servicer class** (expected file: `python-sdk/src/mattermost_plugin/servicers/hooks_servicer.py` or in `server.py` if keeping it small):
  - Constructed with a `Plugin` instance.
  - Uses hook registry (`Plugin.has_hook`, `Plugin.implemented_hooks`) to:
    - implement the `Implemented` RPC (returns canonical hook names).
    - short-circuit calls when a hook isn’t implemented (return default response / UNIMPLEMENTED depending on proto contract).
  - Uses hook runner (timeout + sync/async) for all hook handler invocations.

### Implement lifecycle hooks
- [ ] **Implemented**
  - Return list of canonical hook names (`OnActivate`, `MessageWillBePosted`, etc.) derived from the decorator registry.
  - Ensure list includes only hooks actually decorated/implemented by the plugin subclass.
- [ ] **OnConfigurationChange**
  - Invoke `plugin.on_configuration_change(...)` (or mapped handler) if implemented.
  - If handler returns an error or raises, encode per “error transport rules” above.
- [ ] **OnActivate / OnDeactivate**
  - Implement activation semantics:
    - If handler indicates failure, activation should fail in a way the Go supervisor treats as activation failure.
  - Ensure deactivation is best-effort and doesn’t wedge shutdown.

### Implement message hooks
- [ ] **MessageWillBePosted**
  - Convert protobuf post → Python wrapper (or keep pb object) and call handler.
  - Implement full semantics from `server/public/plugin/hooks.go` including `DismissPostError`.
  - Convert returned post (if non-nil) back to protobuf for response.
- [ ] **MessageWillBeUpdated**
  - Provide both `new_post` and `old_post` to handler.
  - Return modified post or rejection string (per Go semantics).
- [ ] **MessageHasBeenPosted / MessageHasBeenUpdated / MessageHasBeenDeleted**
  - Best-effort fire-and-forget semantics; on exception, return gRPC error (Go side should log and continue).
- [ ] **MessagesWillBeConsumed**
  - Accept list of posts, allow plugin to return modified list.
  - If not implemented, return original list unchanged.

### Tests (integration-style but fast)
- [ ] **Add a fake plugin class** in tests implementing a subset of hooks and asserting:
  - `Implemented` returns only those implemented hooks.
  - `MessageWillBePosted`:
    - allow path returns allow response
    - reject path returns rejection reason
    - modify path returns modified post
    - dismiss path returns `DismissPostError`
  - Exceptions in handler surface as gRPC `INTERNAL`.
- [ ] **gRPC in-process tests**
  - Start `grpc.aio.server()` on ephemeral port with the hook servicer registered.
  - Use generated stub to invoke methods and assert behavior.

### Checkpoints
- [ ] **Checkpoint A:** lifecycle hooks behave correctly (activation failure propagates).
- [ ] **Checkpoint B:** message hook semantics match `server/public/plugin/hooks.go`.
</tasks>

<verification>
- `cd python-sdk && python -m pip install -e '.[dev]'`
- `pytest -q python-sdk/tests -k 'hooks or message or activate'`
</verification>

<success_criteria>
- Python hook servicer implements lifecycle + message hooks with correct semantics.
- `Implemented` RPC returns correct canonical hook names based on decorator registry.
- Message hook return semantics (allow/reject/modify/dismiss) are correct and covered by tests.
- Handler exceptions are surfaced as gRPC errors (status code policy documented and tested).
</success_criteria>

<output>
- New/updated files (expected, non-exhaustive):
  - `python-sdk/src/mattermost_plugin/servicers/hooks_servicer.py` (or equivalent)
  - `python-sdk/tests/test_hooks_lifecycle.py`
  - `python-sdk/tests/test_hooks_messages.py`
</output>


