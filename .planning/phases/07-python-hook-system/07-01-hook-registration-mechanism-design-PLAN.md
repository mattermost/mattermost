# Phase 7 — Python Hook System
## Plan 07-01: Hook registration mechanism design + plugin runtime bootstrap

<objective>
Create the Python-side hook framework that plugin authors will use:
- A Pythonic hook registration pattern (decorator + `Plugin` base class) that produces a canonical `Implemented()` hook list.
- A reusable hook invocation runner (supports sync + async handlers, timeouts, consistent exception -> gRPC error conversion).
- A plugin runtime bootstrap that starts the plugin’s gRPC server, registers hook + health services, prints the go-plugin handshake line to stdout, and blocks until shutdown.
- Minimal tests proving registry + bootstrap correctness.
</objective>

<execution_context>
- Repo root: `mattermost-python-in-plugins/`
- Phase: 7 (Python Hook System)
- Plan: 07-01
- Depends on:
  - Phase 6 output: Python SDK skeleton exists at `python-sdk/` (package `mattermost_plugin`)
  - Phase 3 output: hook service protobuf exists (expected: `server/public/pluginapi/grpc/proto/hooks.proto`)
  - Phase 5 output (interface contract): Go supervisor starts Python process and expects a go-plugin compatible handshake + gRPC health service
- Primary references:
  - `.planning/phases/07-python-hook-system/07-RESEARCH.md` (decisions + pitfalls)
  - `.planning/phases/05-python-supervisor/05-RESEARCH.md` (handshake + health expectations)
  - `.planning/phases/06-python-sdk-core/06-01-python-package-structure-and-grpc-client-setup-PLAN.md` (sdk layout + env var contract)
  - `server/public/plugin/hooks.go` (canonical hook names + semantics)
</execution_context>

<context>
- **Core value:** full parity with Go plugins: every hook in `server/public/plugin/hooks.go` must be receivable in Python with identical semantics.
- **Canonical hook names:** the Go supervisor expects hook names exactly as in `server/public/plugin/hooks.go` (e.g., `OnActivate`, `MessageWillBePosted`, `OnSAMLLogin`).
- **Handshake requirement (Phase 5 research):** Python plugin prints first stdout line:
  - `1|1|tcp|127.0.0.1:<PORT>|grpc`
  - No output must precede this line (configure logging to stderr or after handshake).
- **Health requirement (Phase 5 research):** Python plugin must serve `grpc.health.v1.Health` and report service `"plugin"` as `SERVING`, or the supervisor will restart it.
- **Python SDK location:** all runtime code lives under `python-sdk/src/mattermost_plugin/`.
- **Timeouts + async:** servicer methods should be async (`grpc.aio`). Hook handlers may be sync or async; enforce a default timeout (start with 30s) via `asyncio.wait_for`.
</context>

<tasks>
### Mandatory discovery (Level 0 → 2)
- [ ] **Confirm Phase 6 SDK layout exists**:
  - Verify `python-sdk/pyproject.toml` + `python-sdk/src/mattermost_plugin/` exist.
  - If missing, stop and execute Phase 6 plan(s) first.
- [ ] **Confirm hook protobuf surface exists**:
  - Verify `server/public/pluginapi/grpc/proto/hooks.proto` exists and generates a `*_pb2_grpc.PluginHooksServicer` (exact names may differ).
  - Record the exact gRPC service name + method names (must match `server/public/plugin/hooks.go`).
- [ ] **Confirm supervisor-to-Python contract** (from actual Phase 5 code, not just research):
  - Determine how the Python process learns the *server* API target (expected env var: `MATTERMOST_PLUGIN_API_TARGET` per Phase 6).
  - Determine whether the supervisor uses **go-plugin gRPC mode** or a **custom handshake parser**. If go-plugin gRPC mode is used, confirm any additional protocol expectations beyond the handshake line + health service.
- [ ] **Confirm Python version policy**:
  - Phase 6 plan recommends `>=3.9`; Phase 7 research assumes `>=3.10`/`>=3.11` for modern typing + `asyncio.to_thread`.
  - Decide project minimum and document it in code (use `typing_extensions` if keeping 3.9).

### Define the Python developer-facing API (design checkpoint)
- [ ] **Decide public API primitives** (document in docstrings and in `mattermost_plugin/__init__.py` exports):
  - `Plugin` base class (plugin authors subclass it)
  - `hook` decorator (plugin authors annotate methods)
  - `serve_plugin(...)` / `run_plugin_main(...)` (bootstrap entrypoint)
  - Optional: `HookName` enum for canonical hook identifiers
- [ ] **Decide canonical hook name strategy**:
  - Must emit names matching `server/public/plugin/hooks.go` for the `Implemented()` RPC.
  - Recommendation: store canonical names as `HookName` enum values (e.g., `HookName.OnActivate = "OnActivate"`), and allow decorator usage:
    - `@hook(HookName.OnActivate)` (preferred)
    - `@hook("OnActivate")` (allowed)
    - `@hook()` inferring from method name (optional; must handle acronyms like HTTP/SAML/WebSocket or require explicit overrides)

### Implement registration + registry
- [ ] **Add hook decorator** `python-sdk/src/mattermost_plugin/hooks.py`:
  - Marks methods with hook metadata (canonical hook name).
  - Preserves signature and docstring via `functools.wraps`.
  - Enforces “single handler per hook” (Phase 7 research recommendation) with a clear error on duplicates.
- [ ] **Add `Plugin` base class** `python-sdk/src/mattermost_plugin/plugin.py`:
  - Uses `__init_subclass__` to discover decorated methods and build a class-level registry: `canonical_hook_name -> function`.
  - Exposes:
    - `implemented_hooks() -> list[str]` (canonical names)
    - `has_hook(name: str) -> bool`
    - `invoke_hook(name: str, *args, **kwargs)` (internal)
  - Provides standard fields: `self.api` (from Phase 6 client), `self.logger` (stdlib logging), and `self.config` (plugin runtime config).

### Implement hook invocation runner (timeout + sync/async support)
- [ ] **Add hook runner utility** (e.g., `python-sdk/src/mattermost_plugin/_internal/hook_runner.py`):
  - Accepts a callable (sync or async), runs it with:
    - timeout (`asyncio.wait_for`)
    - optional `asyncio.to_thread` for sync callables to avoid blocking the event loop
  - Converts uncaught exceptions into gRPC errors (default: `grpc.StatusCode.INTERNAL`) with useful details.

### Implement bootstrap gRPC server + handshake
- [ ] **Add plugin server module** `python-sdk/src/mattermost_plugin/server.py`:
  - Builds `grpc.aio.server()` with sane defaults (message size limits consistent with Phase 6 channel options).
  - Registers:
    - Hook servicer (implementation will be filled in Phase 07-02/07-03)
    - Health service (`grpc.health.v1.Health`) reporting `"plugin": SERVING`
  - Binds to `127.0.0.1:0`, obtains the assigned port, starts server.
  - Prints handshake line **as the first stdout line**: `1|1|tcp|127.0.0.1:<port>|grpc` (flush=True).
  - Waits for termination and supports graceful shutdown via signal handling.
- [ ] **Add runtime config loader** (e.g., `python-sdk/src/mattermost_plugin/runtime_config.py`):
  - Reads env vars passed by supervisor:
    - `MATTERMOST_PLUGIN_ID`
    - `MATTERMOST_PLUGIN_API_TARGET`
    - optional: hook timeout seconds, log level, etc.
  - Produces a typed config object consumed by `Plugin` + server bootstrap.

### Tests (TDD-oriented; keep them fast and deterministic)
- [ ] **Registry tests** `python-sdk/tests/test_hook_registry.py`:
  - Decorated methods are discovered via `__init_subclass__`.
  - Duplicate registration fails loudly.
  - `implemented_hooks()` emits canonical names and is stable.
- [ ] **Hook runner tests** `python-sdk/tests/test_hook_runner.py`:
  - Sync handler is executed without blocking (uses `to_thread` path).
  - Async handler is awaited.
  - Timeout produces an expected gRPC status (e.g., `DEADLINE_EXCEEDED` or `INTERNAL` with details; decide and lock it down).
- [ ] **Handshake/health bootstrap smoke test** `python-sdk/tests/test_plugin_bootstrap.py`:
  - Starts server on ephemeral port.
  - Confirms health `Check(service="plugin")` returns `SERVING`.
  - Confirms handshake formatter produces correct string (don’t rely on actual stdout ordering unless you can capture deterministically).

### Checkpoints
- [ ] **Checkpoint A (API + registry):** plugin subclass + decorator produces correct canonical `Implemented()` list.
- [ ] **Checkpoint B (runtime):** plugin can start gRPC server, responds to health checks, and prints correct handshake line.
</tasks>

<verification>
- `cd python-sdk && python -m pip install -e '.[dev]'`
- `pytest -q`
- (Optional) local smoke:
  - Run a tiny `main.py` that starts `serve_plugin(...)` and verify it prints handshake line and stays running.
</verification>

<success_criteria>
- Hook decorator + `Plugin` base class exist and reliably produce canonical hook names matching `server/public/plugin/hooks.go`.
- A reusable hook runner enforces timeout and supports sync/async handlers.
- Plugin bootstrap starts an async gRPC server with health service and emits a go-plugin compatible handshake line as first stdout output.
- New unit tests for registry/runner/bootstrap pass.
</success_criteria>

<output>
- New/updated files (expected, non-exhaustive):
  - `python-sdk/src/mattermost_plugin/hooks.py`
  - `python-sdk/src/mattermost_plugin/plugin.py`
  - `python-sdk/src/mattermost_plugin/server.py`
  - `python-sdk/src/mattermost_plugin/runtime_config.py`
  - `python-sdk/src/mattermost_plugin/_internal/hook_runner.py`
  - `python-sdk/tests/test_hook_registry.py`
  - `python-sdk/tests/test_hook_runner.py`
  - `python-sdk/tests/test_plugin_bootstrap.py`
- No Go-side changes in this plan (those belong to Phase 5/4).
</output>


