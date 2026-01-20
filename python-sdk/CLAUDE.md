# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with the Mattermost Python Plugin SDK.

## Repository Purpose

This is the Python SDK for Mattermost plugins. It provides:
- gRPC client for calling Mattermost Plugin API
- Plugin base class and hook decorators
- Type-safe wrappers for Mattermost data types

## Key Commands

### Setup

```bash
# Create virtual environment with dev dependencies
make venv

# Activate environment
source .venv/bin/activate
```

### Development

```bash
# Regenerate gRPC code from proto files
make proto-gen

# Run tests
make test

# Run type checking
make lint

# Build package
make build
```

### Testing

```bash
# Run all tests
pytest tests/ -v

# Run specific test file
pytest tests/test_hooks_lifecycle.py -v

# Run integration tests (requires Go binaries)
pytest tests/test_integration_e2e.py -v
```

## Architecture Overview

### Directory Structure

```
python-sdk/
├── src/mattermost_plugin/
│   ├── __init__.py          # Public API exports
│   ├── plugin.py            # Plugin base class
│   ├── hooks.py             # @hook decorator and HookName enum
│   ├── client.py            # Sync API client
│   ├── async_client.py      # Async API client
│   ├── server.py            # gRPC server for hooks
│   ├── exceptions.py        # Exception types
│   ├── _internal/           # Internal implementation
│   │   └── wrappers.py      # Proto-to-Python type wrappers
│   ├── grpc/                # Generated gRPC code (do not edit)
│   └── servicers/           # gRPC servicer implementations
│       └── hooks_servicer.py
├── tests/                   # Test suite
└── scripts/
    └── generate_protos.py   # Proto generation script
```

### Key Components

1. **Plugin Class** (`plugin.py`)
   - Base class all plugins inherit from
   - Provides `self.api` and `self.logger`
   - Uses `__init_subclass__` for hook discovery

2. **Hook System** (`hooks.py`)
   - `@hook(HookName.X)` decorator
   - `HookName` enum with all available hooks
   - Automatic registration via metaclass

3. **API Client** (`client.py`)
   - Typed wrapper around gRPC stubs
   - Mixin classes for API domains (UsersMixin, ChannelsMixin, etc.)
   - Converts proto types to Python dataclasses

4. **gRPC Server** (`server.py`)
   - PluginHooks gRPC server
   - Handles hook dispatch from Go server
   - Health checking for go-plugin protocol

### Code Generation

Proto files are in `server/public/pluginapi/grpc/proto/`. After modifying:

```bash
# From python-sdk/
make proto-gen

# Or from server/
make python-proto-gen
```

Generated files go to `src/mattermost_plugin/grpc/`.

## Best Practices

1. **Type Annotations**: All public APIs must have type hints
2. **Proto Wrappers**: Use `_internal/wrappers.py` for proto conversions
3. **Testing**: Add tests for any new hooks or API methods
4. **Backwards Compatibility**: Don't break existing plugin APIs
5. **Generated Code**: Never manually edit files in `grpc/` directory

## Adding a New Hook

1. Define hook in `server/public/pluginapi/grpc/proto/hooks_*.proto`
2. Run `make proto-gen-all` from server/
3. Add to `HookName` enum in `hooks.py`
4. Add handler in `servicers/hooks_servicer.py`
5. Add test in `tests/test_hooks_*.py`

## Adding a New API Method

1. Define RPC in `server/public/pluginapi/grpc/proto/api*.proto`
2. Run `make proto-gen-all` from server/
3. Add to appropriate mixin in `client.py`
4. Add wrapper types to `_internal/wrappers.py` if needed
5. Add test in `tests/test_client_*.py`
