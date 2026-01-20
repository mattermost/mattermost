# Phase 6 — Python SDK Core
## Plan 06-04: Typed API client for remaining methods (full parity)

<objective>
Finish Phase 6 by covering **all remaining Plugin API RPCs** not implemented in 06-02 and 06-03, and make the SDK “done enough” to build the hook system on top:
- Implement client methods for all remaining RPCs (commands, config, plugins, preferences, telemetry, etc.)
- Finalize exception mapping and shared conversion utilities
- Enforce full RPC coverage via audit tooling (no missing methods)
- Decide and implement the sync/async support contract for v1
</objective>

<execution_context>
- Repo root: `mattermost-python-in-plugins/`
- Phase: 6 (Python SDK Core)
- Plan: 06-04
- Requires: 06-01, 06-02, 06-03 completed (SDK exists, and major domains covered)
- Inputs:
  - Full Plugin API proto surface is defined (Phase 2)
  - Go gRPC server implements it (Phase 4)
- Upstream truth for “done”:
  - `server/public/plugin/api.go` (interface) and the gRPC service definition derived from it
</execution_context>

<context>
This plan is intentionally broad: it completes the “long tail” of the Plugin API surface.
Typical remaining areas include (names may differ depending on proto organization):
- Configuration + plugin configuration
- Commands and command execution
- Permissions/roles checks
- Bots
- OAuth / external integrations
- Preferences
- Cluster/events/metrics/telemetry

Some areas may require special representation decisions in protobuf (e.g., config structs, JSON-y maps). Follow the proto definitions as the source of truth and expose Pythonic types where reasonable.
</context>

<tasks>
### Mandatory discovery + scope sizing (Level 0 → 1)
- [ ] **Compute the “remaining RPC list”**:
  - List all RPCs from the service descriptor
  - Subtract (or exclude) those already enforced by prior plan scopes
  - Confirm the remaining count is feasible for one plan
  - If not feasible, split into additional plans (e.g., `06-04a`, `06-04b`) by domain.

### Finish coverage: client methods for all remaining RPCs
- [ ] **Implement remaining sync client methods**:
  - Apply the same rules:
    - request construction
    - response conversion
    - `grpc.RpcError` → SDK exceptions
- [ ] **Decide v1 async contract**
  - Option A (recommended long-term): **sync+async parity**
    - Implement the same RPC surface on `AsyncPluginAPIClient`
    - Keep shared conversions in common helpers to reduce duplication
  - Option B (short-term): **sync complete, async limited**
    - Clearly mark async as “preview” in docstrings and raise `NotImplementedError` for missing methods
  - Pick one and make it consistent across the SDK.

### Conversions + exception mapping completeness
- [ ] **Audit conversions for “leaky protobuf”**:
  - Public methods should not require callers to import from `mattermost_plugin.grpc.*`
  - If certain proto messages are too large to wrap immediately, add explicit, intentional escape hatches (documented in docstrings) rather than accidental leaks.
- [ ] **Complete error mapping**
  - Ensure all commonly encountered `grpc.StatusCode` values map to stable SDK exceptions.
  - Add at least one test per mapped status code.

### Tooling and tests for full parity
- [ ] **Upgrade audit script to “full enforcement” mode**
  - Add a mode that asserts *every* RPC has a corresponding Python method (no include/exclude).
  - Decide the canonical RPC→method naming transform and enforce it.
  - Run it in CI later (Phase 10), but make it runnable locally now.
- [ ] **Tests**
  - Expand unit tests (mocked stub) to cover representative calls in the newly-covered areas.
  - Add at least one integration-style gRPC roundtrip test for a non-trivial remaining RPC.
</tasks>

<verification>
- `cd python-sdk && python scripts/generate_protos.py`
- **Full coverage audit**
  - `python scripts/audit_client_coverage.py`  (no include/exclude; fail on any missing method)
- `pytest -q`
- `mypy src/mattermost_plugin`
</verification>

<success_criteria>
- The SDK provides a callable Python method for every RPC in the Plugin API gRPC service definition.
- The audit script passes in “full enforcement” mode.
- Errors are surfaced as SDK exceptions (no raw gRPC exceptions in the public surface).
- Sync/async contract is clear and consistently implemented.
- Unit tests provide representative coverage of the newly completed areas.
</success_criteria>

<output>
- Modified:
  - `python-sdk/src/mattermost_plugin/client.py` (and optional mixins/modules)
  - `python-sdk/src/mattermost_plugin/async_client.py` (depending on async contract)
  - `python-sdk/src/mattermost_plugin/_internal/*` (wrappers/converters expanded)
  - `python-sdk/src/mattermost_plugin/exceptions.py` (complete mapping)
  - `python-sdk/scripts/audit_client_coverage.py` (full enforcement mode)
  - `python-sdk/tests/*` (expanded coverage)
</output>


