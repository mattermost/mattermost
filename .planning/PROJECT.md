# Mattermost Multi-Language Plugin Support

## What This Is

An extension to Mattermost's plugin system enabling server-side plugins in languages beyond Go, starting with Python. Uses gRPC for language-agnostic communication while maintaining the subprocess-per-plugin model and seamless integration with the existing plugin infrastructure.

**v1.0 shipped** with full Python plugin support — 236 API methods and 35+ hooks working identically to Go plugins.

## Core Value

Full API coverage: every API method and hook available to Go plugins must work identically from Python plugins.

## Requirements

### Validated

- ✓ Go plugin system via hashicorp/go-plugin — existing
- ✓ net/rpc protocol for Go plugin communication — existing
- ✓ Plugin API interface with 100+ methods (users, channels, posts, teams, etc.) — existing
- ✓ Plugin hooks for server events (MessagePosted, UserCreated, ServeHTTP, etc.) — existing
- ✓ Subprocess-per-plugin process model — existing
- ✓ Plugin manifest system for metadata and configuration — existing
- ✓ Database Driver interface for direct DB access — existing
- ✓ gRPC protocol layer for cross-language plugin communication — v1.0
- ✓ Protocol buffer definitions for all Plugin API methods (236 RPCs) — v1.0
- ✓ Protocol buffer definitions for all plugin hooks (35+ hooks) — v1.0
- ✓ Python plugin supervisor (Go-side process management) — v1.0
- ✓ Python plugin SDK with typed API client — v1.0
- ✓ ServeHTTP streaming support over gRPC — v1.0
- ✓ Manifest support for Python executables/entry points — v1.0
- ✓ Python hook implementation pattern (decorators) — v1.0
- ✓ Full parity: all Go plugin API methods callable from Python — v1.0
- ✓ Full parity: all Go plugin hooks receivable in Python — v1.0

### Active

None — v1.0 complete

### Out of Scope

- Webapp plugins — staying JavaScript/React, this is server-side only
- Performance parity guarantees — Python will have inherent overhead vs Go
- Embedded Python interpreter — using subprocess model instead
- Other languages in v1 — Python first, architecture enables future languages

## Current State

**Version:** v1.1 LangChain Agent Demo (shipped 2026-01-20)

**Shipped Versions:**
- v1.0: Python Plugin Support (2026-01-20) — 236 API methods, 35+ hooks, full parity with Go
- v1.1: LangChain Agent Demo (2026-01-20) — Dual LLM bots, threading history, MCP client, agentic loops

**Tech Stack:**
- Go gRPC server: ~70k LOC (proto definitions + handlers + converters)
- Python SDK: ~31k LOC (typed client, hooks, wrappers)
- Python Agent Demo: ~200 LOC (LangChain agent with MCP integration)
- Protocol: gRPC with Protocol Buffers v3
- Integration: hashicorp/go-plugin with custom PluginHooks service
- Ecosystem: LangChain 0.1+, Anthropic SDK, OpenAI SDK, MCP client library

**Architecture:**
```
Mattermost Server
    └── Python Supervisor (Go)
           ├── Spawns Python subprocess
           ├── Establishes gRPC connection (go-plugin)
           └── Starts PluginAPI callback server
                   │
                   ▼
           Python Plugin (subprocess)
               ├── PluginHooks gRPC server (receives hooks)
               └── PluginAPI gRPC client (calls API)
```

**Key Files:**
- `server/public/pluginapi/grpc/proto/*.proto` — Protocol definitions
- `server/public/pluginapi/grpc/server/` — Go gRPC handlers
- `server/public/plugin/python_supervisor.go` — Process management
- `server/public/plugin/hooks_grpc_client.go` — Hook dispatch
- `python-sdk/src/mattermost_plugin/` — Python SDK

## Context

**What was built:**
- Complete gRPC infrastructure enabling Python plugins
- Python SDK with Pythonic patterns (decorators, type hints, dataclasses)
- Bidirectional streaming for HTTP request/response handling
- Full server integration with existing plugin infrastructure

**Tested with:**
- Example `hello_python` plugin demonstrating hooks and API calls
- Integration tests for Python plugin lifecycle
- Benchmark tests comparing Go RPC vs Python gRPC overhead

## Constraints

- **Backward Compatibility**: Existing Go plugins continue working unchanged. The gRPC layer is additive.
- **Monolithic Server**: Python plugins run as subprocesses, just like Go plugins.
- **Plugin Manifest**: Extended format remains valid for Go plugins.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| gRPC over JSON-RPC | Strong typing via protobuf, excellent Python/Go support, streaming for ServeHTTP | ✓ Good |
| Subprocess per plugin | Matches existing Go model, isolation, simpler than embedded interpreter | ✓ Good |
| Python first | Most requested language, large ecosystem, good gRPC support | ✓ Good |
| Per-group proto files | Maintainability: api_user_team, api_channel_post, etc. | ✓ Good |
| JSON blob for complex types | Config, License, Manifest use bytes to avoid proto churn | ✓ Good |
| @hook decorator pattern | Pythonic registration, works with __init_subclass__ | ✓ Good |
| 64KB chunks for HTTP streaming | Balances latency vs overhead | ✓ Good |
| hooksGRPCClient adapter | Implements Hooks interface, mirrors hooksRPCClient pattern | ✓ Good |
| Separate API callback server | Breaks import cycle, clean lifecycle management | ✓ Good |
| Bot membership lookup for DM routing | More reliable than parsing channel name | ✓ Good |
| LangChain message types for prompts | Provider-agnostic SystemMessage/HumanMessage format | ✓ Good |
| Thread-based conversation history | Use get_post_thread to fetch context, map to HumanMessage/AIMessage | ✓ Good |
| Graceful fallback without MCP | Falls back to basic model.invoke() when tools unavailable | ✓ Good |
| Tenacity retry for transient errors only | ConnectionError/TimeoutError benefit from retry; others fail fast | ✓ Good |

---
*Last updated: 2026-01-20 after v1.1 milestone completion*
