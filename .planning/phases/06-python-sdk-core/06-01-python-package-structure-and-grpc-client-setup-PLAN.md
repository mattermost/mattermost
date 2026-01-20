# Phase 6 — Python SDK Core
## Plan 06-01: Python package structure and gRPC client setup

<objective>
Create the foundational Python SDK package that Python plugins will import:
- Packaging (`pyproject.toml`) and `src/` layout
- Protobuf + gRPC stub generation (with type stubs via mypy-protobuf)
- Core sync client (context-managed channel lifecycle) + async client skeleton
- SDK exception strategy (never leak raw `grpc.RpcError`)
- Minimal smoke tests proving codegen and client wiring works
</objective>

<execution_context>
- Repo root: `mattermost-python-in-plugins/`
- Phase: 6 (Python SDK Core)
- Plan: 06-01
- Depends on:
  - Phase 1 output: proto layout exists at `server/public/pluginapi/grpc/proto/` (see Phase 1 research)
  - Phase 4 output: Go gRPC server implements Plugin API service for Python plugins
  - Phase 5 output (interface contract): supervisor provides the API target address to the Python process (env var or argv)
- Primary references:
  - `.planning/phases/06-python-sdk-core/06-RESEARCH.md`
  - `.planning/phases/01-protocol-foundation/01-RESEARCH.md` (proto layout)
  - `.planning/phases/05-python-supervisor/05-RESEARCH.md` (handshake + health expectations)
</execution_context>

<context>
- **Core value:** full API parity with Go plugins (same semantics, errors, hooks).
- **Proto layout (Phase 1):**
  - `server/public/pluginapi/grpc/proto/plugin.proto` (core types)
  - `server/public/pluginapi/grpc/proto/api.proto` (Plugin API service)
  - `server/public/pluginapi/grpc/proto/hooks.proto` (hook callbacks)
- **Python SDK standards (Phase 6 research):**
  - Use `grpcio`, `grpcio-tools`, `protobuf`
  - Use `mypy-protobuf` + `types-protobuf` for IDE/mypy type stubs
  - Provide context-manager client (`__enter__/__exit__`) to avoid channel leaks
  - Do not expose generated `_pb2` modules as public API
  - Provide a custom exception hierarchy, map `grpc.StatusCode` to SDK exceptions
- **Repo reality check (Phase 6 planning discovery):**
  - No existing `.proto` files or Python packaging exist yet in this repo; Phase 6 adds them.
</context>

<tasks>
### Mandatory discovery (Level 0 → 2)
- [ ] **Confirm Phase 1 artifacts exist**:
  - `server/public/pluginapi/grpc/proto/{plugin,api,hooks}.proto`
  - If the proto layout differs, update this plan’s paths before proceeding.
- [ ] **Confirm Phase 4 contract**:
  - Identify the gRPC service name + package (expected: `mattermost.plugin.PluginAPI`) and how Python connects (host:port vs unix socket).
  - Decide the single source of truth for target discovery in Python (recommendation: env var, e.g., `MATTERMOST_PLUGIN_API_TARGET`).
- [ ] **Confirm Python runtime policy**:
  - Set minimum supported Python version for SDK (recommendation: `>=3.9` per research).

### Create SDK package scaffold
- [ ] **Create repo directory** `python-sdk/` at the repo root with `src/` layout:
  - `python-sdk/pyproject.toml`
  - `python-sdk/src/mattermost_plugin/` (package root)
  - `python-sdk/scripts/` (developer tooling)
  - `python-sdk/tests/` (unit tests)
- [ ] **Define packaging metadata** in `pyproject.toml`:
  - Name (working name): `mattermost-plugin-sdk`
  - `requires-python = ">=3.9"`
  - Runtime deps: `grpcio>=1.60`, `protobuf>=4.25`
  - Dev extras: `grpcio-tools`, `mypy-protobuf`, `types-protobuf`, `mypy`, `pytest`, `pytest-asyncio`
  - Mypy config: ignore generated modules (`mattermost_plugin.grpc.*`)

### Protobuf + gRPC code generation
- [ ] **Add generator script** `python-sdk/scripts/generate_protos.py` that:
  - Uses `python -m grpc_tools.protoc`
  - Inputs: `server/public/pluginapi/grpc/proto/*.proto`
  - Outputs to: `python-sdk/src/mattermost_plugin/grpc/`
  - Generates:
    - `*_pb2.py` + `*_pb2_grpc.py`
    - `*_pb2.pyi` + `*_pb2_grpc.pyi` via `--mypy_out` / `--mypy_grpc_out`
  - Ensures `python-sdk/src/mattermost_plugin/grpc/__init__.py` exists
- [ ] **Decide generated-code policy**:
  - Commit generated code or generate in CI? (recommendation: commit generated for ease of plugin distribution; revisit once CI story is clear)

### Core SDK runtime: clients + errors
- [ ] **Add channel factory** (e.g., `mattermost_plugin/_internal/channel.py`) that:
  - Creates secure/insecure channels (initially insecure for localhost; make TLS a future option)
  - Applies keepalive + message size options (per Phase 6 research)
- [ ] **Add exception hierarchy** (`mattermost_plugin/exceptions.py`) and `convert_grpc_error()` utility:
  - Base: `PluginAPIError(code: grpc.StatusCode | None)`
  - Start with common subclasses: `NotFoundError`, `PermissionDeniedError`, `ValidationError`, `AlreadyExistsError`, `UnavailableError`
  - Ensure no public method leaks `grpc.RpcError`
- [ ] **Add sync client** (`mattermost_plugin/client.py`) with:
  - `__enter__/__exit__` managing channel lifecycle
  - Internal stub: `api_pb2_grpc.PluginAPIStub`
  - One “smoke” method implemented end-to-end (recommendation: `get_server_version()` or similarly simple RPC)
- [ ] **Add async client skeleton** (`mattermost_plugin/async_client.py`):
  - `__aenter__/__aexit__`, uses `grpc.aio`
  - Implement at least the same smoke method as sync client
- [ ] **Public API surface**: `mattermost_plugin/__init__.py` should export clients + exceptions only (no `grpc` package exports).

### Tests (minimum viable)
- [ ] **Codegen smoke test**:
  - Test that `mattermost_plugin.grpc.api_pb2_grpc` imports successfully after generation.
- [ ] **Client smoke test**:
  - Spin up an in-process fake gRPC server implementing just the smoke RPC.
  - Assert sync client can connect and returns the expected result.
  - Assert one error mapping path (e.g., server returns NOT_FOUND → SDK raises `NotFoundError`).
</tasks>

<verification>
- **Codegen**
  - `cd python-sdk && python -m pip install -e '.[dev]'`
  - `python scripts/generate_protos.py`
  - `python -c "from mattermost_plugin.grpc import api_pb2_grpc; print('ok')"`
- **Unit tests**
  - `pytest -q`
- **Type checking (SDK code only)**
  - `mypy src/mattermost_plugin`
</verification>

<success_criteria>
- Python SDK scaffold exists under `python-sdk/` with `pyproject.toml` and `src/` layout.
- Protobuf + gRPC stubs (and `.pyi` stubs) generate cleanly from `server/public/pluginapi/grpc/proto/*.proto`.
- Sync client connects via context manager and successfully executes one smoke RPC.
- Async client skeleton exists and can execute the same smoke RPC.
- SDK raises SDK-specific exceptions (no `grpc.RpcError` leaks) for at least one mapped error code.
- `pytest` passes for the new SDK tests.
</success_criteria>

<output>
- New directory: `python-sdk/`
- New files (expected, non-exhaustive):
  - `python-sdk/pyproject.toml`
  - `python-sdk/scripts/generate_protos.py`
  - `python-sdk/src/mattermost_plugin/__init__.py`
  - `python-sdk/src/mattermost_plugin/client.py`
  - `python-sdk/src/mattermost_plugin/async_client.py`
  - `python-sdk/src/mattermost_plugin/exceptions.py`
  - `python-sdk/src/mattermost_plugin/_internal/channel.py`
  - `python-sdk/tests/test_codegen_imports.py`
  - `python-sdk/tests/test_client_smoke.py`
- Generated (location may be committed or generated-on-demand):
  - `python-sdk/src/mattermost_plugin/grpc/*_pb2*.py` and `*.pyi`
</output>


