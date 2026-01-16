# Phase 6-01 Summary: Python Package Structure and gRPC Client Setup

**Completed:** 2026-01-16
**Status:** SUCCESS

## Objective

Create the foundational Python SDK package that Python plugins will import, including:
- Package structure with pyproject.toml and src/ layout
- Protobuf + gRPC stub generation with type stubs
- Core sync and async clients with context manager support
- SDK exception hierarchy with gRPC error mapping
- Smoke tests proving codegen and client wiring works

## Tasks Completed

### 1. Discovery and Verification
- Confirmed Phase 1 proto artifacts exist at `server/public/pluginapi/grpc/proto/` (18 .proto files)
- Verified proto package is `mattermost.pluginapi.v1`
- Service name is `PluginAPI` defined in `api.proto`

### 2. SDK Package Scaffold
- Created `python-sdk/` directory at repo root
- Implemented src/ layout with `mattermost_plugin` package
- Created `pyproject.toml` with:
  - Package name: `mattermost-plugin-sdk`
  - Version: `0.1.0`
  - Python requirement: `>=3.9`
  - Dependencies: `grpcio>=1.60.0`, `protobuf>=4.25.0`
  - Dev extras: `grpcio-tools`, `mypy-protobuf`, `types-protobuf`, `mypy`, `pytest`, `pytest-asyncio`
  - Mypy configuration to ignore generated code

### 3. Protobuf Code Generation
- Created `scripts/generate_protos.py` that:
  - Uses `grpc_tools.protoc` for code generation
  - Generates Python protobuf code (`*_pb2.py`)
  - Generates gRPC stubs (`*_pb2_grpc.py`)
  - Generates type stubs via mypy-protobuf (`*.pyi`)
  - Fixes imports to use package-relative imports
- Successfully generated 72 files from 18 proto files
- Policy decision: Generated code is committed (not generated in CI)

### 4. Channel Factory
- Created `_internal/channel.py` with:
  - `create_channel()` for sync channels
  - `create_async_channel()` for async channels
  - Default options: keepalive (10s), message size limits (100MB)
  - Support for `MATTERMOST_PLUGIN_API_TARGET` env var

### 5. Exception Hierarchy
- Created `exceptions.py` with:
  - Base: `PluginAPIError` with full error context
  - Subclasses: `NotFoundError`, `PermissionDeniedError`, `ValidationError`, `AlreadyExistsError`, `UnavailableError`
  - `convert_grpc_error()`: maps gRPC StatusCode to SDK exceptions
  - `convert_app_error()`: maps Mattermost AppError to SDK exceptions
  - No raw `grpc.RpcError` leaks to users

### 6. Sync Client
- Created `client.py` with `PluginAPIClient`:
  - Context manager support (`__enter__`/`__exit__`)
  - Channel lifecycle management
  - Implemented smoke methods: `get_server_version()`, `get_system_install_date()`, `get_diagnostic_id()`
  - Logging methods: `log_debug()`, `log_info()`, `log_warn()`, `log_error()`
  - Proper error handling with AppError checking

### 7. Async Client
- Created `async_client.py` with `AsyncPluginAPIClient`:
  - Async context manager support (`__aenter__`/`__aexit__`)
  - Uses `grpc.aio` for native async support
  - Same methods as sync client with `async`/`await`

### 8. Public API Surface
- `mattermost_plugin/__init__.py` exports:
  - `PluginAPIClient`, `AsyncPluginAPIClient`
  - All exception types
  - `convert_grpc_error` utility
  - `__version__`

### 9. Tests
- `test_codegen_imports.py`: 24 tests verifying all generated modules import correctly
- `test_client_smoke.py`: 18 tests verifying:
  - Client lifecycle (connect/disconnect/context manager)
  - RPC calls (get_server_version, etc.)
  - Error mapping (gRPC errors -> SDK exceptions)
  - AppError conversion
  - Exception hierarchy

## Verification Results

```
pytest -v tests/
============================== 42 passed in 0.17s ==============================
```

All verification commands pass:
- `pip install -e .` - successful
- `python scripts/generate_protos.py` - generates 72 files
- `python -c "from mattermost_plugin.grpc import api_pb2_grpc"` - imports work
- `pytest -q` - 42 tests pass

## Files Created

```
python-sdk/
├── pyproject.toml
├── scripts/
│   └── generate_protos.py
├── src/
│   └── mattermost_plugin/
│       ├── __init__.py
│       ├── client.py
│       ├── async_client.py
│       ├── exceptions.py
│       ├── _internal/
│       │   ├── __init__.py
│       │   └── channel.py
│       └── grpc/
│           ├── __init__.py
│           └── [72 generated files]
└── tests/
    ├── __init__.py
    ├── test_codegen_imports.py
    └── test_client_smoke.py
```

## Commits

1. `3cf6e36477` - feat(06-01): add Python SDK package scaffold with pyproject.toml
2. `aae96ff737` - feat(06-01): add protobuf code generation script
3. `d52baf9345` - feat(06-01): add channel factory and exception hierarchy
4. `5cff580fcb` - feat(06-01): add sync and async Plugin API clients
5. `0c905f4d07` - feat(06-01): add generated protobuf and gRPC Python code
6. `6043b7906a` - test(06-01): add smoke tests for codegen and client

## Deviations

None. All tasks completed as specified in the plan.

## Notes for Future Plans

1. **API Parity**: The current clients implement only smoke test methods. Plans 06-02, 06-03, and 06-04 will add the remaining 200+ API methods.

2. **Generated Code Policy**: Generated protobuf code is committed to the repository. This simplifies plugin distribution but requires regeneration when protos change.

3. **Async Client**: The async client skeleton is complete but only implements the same methods as the sync client. Future plans should ensure parity.

4. **Environment Variable**: The SDK expects `MATTERMOST_PLUGIN_API_TARGET` to be set by the Python supervisor (Phase 5) for automatic target discovery.
