# Phase 7 Plan 07-01: Hook Registration Mechanism Design - Summary

## Execution Summary

**Status:** COMPLETE
**Date:** 2026-01-19
**Tasks Completed:** 9/9 (all tasks merged into 9 logical commits)

## What Was Built

### 1. Hook Decorator (`hooks.py`)
- `@hook` decorator supporting multiple forms:
  - `@hook(HookName.OnActivate)` - preferred, explicit with enum
  - `@hook("OnActivate")` - string form
  - `@hook` - infers from method name (must match exactly)
- `HookName` enum with all 40+ canonical hook names from `hooks.proto`
- `HookRegistrationError` for registration failures
- Validates hook names against known set

### 2. Plugin Base Class (`plugin.py`)
- `Plugin` base class for plugin authors to subclass
- Uses `__init_subclass__` for automatic hook discovery at class definition
- Methods:
  - `implemented_hooks()` - returns sorted list of canonical hook names
  - `has_hook(name)` - check if hook is implemented
  - `invoke_hook(name, *args)` - call registered handler
  - `get_hook_handler(name)` - get bound method for direct invocation
- Properties: `api`, `logger`, `config`
- Enforces single handler per hook

### 3. Hook Runner (`_internal/hook_runner.py`)
- `run_hook_async()` - invoke handlers with timeout support
  - Supports both sync and async handlers
  - Sync handlers run via `asyncio.to_thread` to avoid blocking
  - Timeout via `asyncio.wait_for` (default 30s)
- `HookTimeoutError` and `HookInvocationError` for error handling
- `convert_hook_error_to_grpc_status()` - maps exceptions to gRPC codes
- `HookRunner` class for convenient invocation with defaults

### 4. Runtime Config (`runtime_config.py`)
- `RuntimeConfig` dataclass with:
  - `plugin_id`, `api_target`, `plugin_path`
  - `hook_timeout`, `log_level`
- `RuntimeConfig.from_env()` - loads from environment variables
- `configure_logging()` - sets up Python logging to stderr

### 5. Plugin Server (`server.py`)
- `PluginServer` class managing gRPC server lifecycle
- Registers `grpc.health.v1.Health` service
  - Reports `plugin` service as `SERVING` (required by go-plugin)
- Binds to ephemeral port on `127.0.0.1:0`
- Outputs go-plugin handshake line: `1|1|tcp|127.0.0.1:<port>|grpc`
- `serve_plugin(PluginClass)` - async entry point
- `run_plugin(PluginClass)` - sync entry point

### 6. Public API (`__init__.py`)
Exports:
- `Plugin`, `hook`, `HookName`, `HookRegistrationError`
- `RuntimeConfig`, `load_runtime_config`
- All existing API client exports preserved

### 7. Dependencies (`pyproject.toml`)
Added:
- `grpcio-health-checking>=1.60.0`
- `typing_extensions>=4.0.0;python_version<'3.10'`

## Test Coverage

### test_hook_registry.py (18 tests)
- Hook decorator forms (enum, string, inferred)
- Plugin registration discovery
- Duplicate hook detection
- Hook invocation and argument passing
- HookName enum validation

### test_hook_runner.py (22 tests)
- Sync/async handler execution
- Timeout handling
- Exception wrapping
- gRPC status code conversion
- HookRunner class

### test_plugin_bootstrap.py (15 tests)
- Handshake format validation
- Server ephemeral port binding
- Health check responses
- RuntimeConfig loading
- Full plugin lifecycle integration

**Total: 55 new tests, all passing**

## Commits

1. `a959e8dec0` - feat(07-01): add hook decorator and HookName enum
2. `708e033b57` - feat(07-01): add Plugin base class with hook registry
3. `ef13892007` - feat(07-01): add hook runner utility with timeout support
4. `4fb3c4ed4c` - feat(07-01): add runtime config loader for plugin environment
5. `8bda0eb6ff` - feat(07-01): add plugin server with health service and handshake
6. `49a7a6a121` - feat(07-01): export hook system public API and add dependencies
7. `9cbd52e2ba` - test(07-01): add hook registry unit tests
8. `cf89dd1b32` - test(07-01): add hook runner unit tests
9. `46a931d49d` - test(07-01): add plugin bootstrap smoke tests

## Files Modified

### New Files
- `python-sdk/src/mattermost_plugin/hooks.py` (258 lines)
- `python-sdk/src/mattermost_plugin/plugin.py` (238 lines)
- `python-sdk/src/mattermost_plugin/server.py` (359 lines)
- `python-sdk/src/mattermost_plugin/runtime_config.py` (126 lines)
- `python-sdk/src/mattermost_plugin/_internal/hook_runner.py` (301 lines)
- `python-sdk/tests/test_hook_registry.py` (281 lines)
- `python-sdk/tests/test_hook_runner.py` (327 lines)
- `python-sdk/tests/test_plugin_bootstrap.py` (320 lines)

### Modified Files
- `python-sdk/src/mattermost_plugin/__init__.py` - added hook system exports
- `python-sdk/pyproject.toml` - added grpcio-health-checking dependency

## Deviations

None. All tasks completed as specified in the plan.

## Verification

```bash
cd python-sdk && source .venv/bin/activate && python -m pytest -q
# 152 passed in 1.49s
```

## Next Steps (Phase 07-02/07-03)

1. Implement actual hook servicer that inherits from `PluginHooksServicer`
2. Wire servicer to `PluginServer` to handle hook RPC calls
3. Implement lifecycle hooks: OnActivate, OnDeactivate, OnConfigurationChange
4. Implement message hooks: MessageWillBePosted, MessageHasBeenPosted, etc.
5. Implement remaining hooks per proto definitions

## Usage Example

```python
from mattermost_plugin import Plugin, hook, HookName
from mattermost_plugin.server import run_plugin

class MyPlugin(Plugin):
    @hook(HookName.OnActivate)
    def on_activate(self) -> None:
        self.logger.info("Plugin activated!")
        version = self.api.get_server_version()
        self.logger.info(f"Server version: {version}")

    @hook(HookName.MessageWillBePosted)
    def filter_messages(self, context, post):
        if "spam" in post.message.lower():
            return None, "Spam detected"
        return post, ""

if __name__ == "__main__":
    run_plugin(MyPlugin)
```
