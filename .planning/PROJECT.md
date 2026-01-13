# Mattermost Multi-Language Plugin Support

## What This Is

An extension to Mattermost's plugin system enabling server-side plugins in languages beyond Go, starting with Python. Uses gRPC for language-agnostic communication while maintaining the subprocess-per-plugin model and seamless integration with the existing plugin infrastructure.

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

### Active

- [ ] gRPC protocol layer for cross-language plugin communication
- [ ] Protocol buffer definitions for all Plugin API methods
- [ ] Protocol buffer definitions for all plugin hooks
- [ ] Python plugin supervisor (Go-side process management)
- [ ] Python plugin SDK with typed API client
- [ ] ServeHTTP streaming support over gRPC
- [ ] Manifest support for Python executables/entry points
- [ ] Python hook implementation pattern (decorators or class methods)
- [ ] Full parity: all Go plugin API methods callable from Python
- [ ] Full parity: all Go plugin hooks receivable in Python

### Out of Scope

- Webapp plugins — staying JavaScript/React, this is server-side only
- Performance parity guarantees — Python will have inherent overhead vs Go
- Embedded Python interpreter — using subprocess model instead
- Other languages in v1 — Python first, architecture enables future languages

## Context

**Current Plugin Architecture:**
- Plugins are Go binaries using hashicorp/go-plugin library
- Communication via net/rpc over stdio (Go-to-Go only)
- Server spawns plugin subprocess, establishes RPC connection
- Plugins implement `Hooks` interface, receive `API` for server calls
- `supervisor.go` manages plugin lifecycle, `client_rpc.go` handles RPC marshalling

**Key Files:**
- `server/public/plugin/api.go` — 100+ API methods interface
- `server/public/plugin/hooks.go` — Hook definitions (auto-generated)
- `server/public/plugin/client_rpc.go` — RPC client/server implementations
- `server/public/plugin/supervisor.go` — Plugin process management

**Challenge:**
net/rpc is Go-specific (gob encoding). gRPC with Protocol Buffers provides language-agnostic serialization and has excellent Python support via grpcio.

**Approach:**
1. Define .proto files mirroring the Plugin API and Hooks interfaces
2. Implement gRPC server in Go (server side) and Python client (plugin side)
3. Create Python supervisor that spawns Python plugins, connects via gRPC
4. Build Python SDK that feels native (type hints, Pythonic patterns)

## Constraints

- **Backward Compatibility**: Existing Go plugins must continue working unchanged. The gRPC layer is additive, not replacing net/rpc for Go plugins.
- **Monolithic Server**: No separate containers or sidecar processes. Python plugins run as subprocesses managed by the main Mattermost server, just like Go plugins.
- **Plugin Manifest**: Must extend existing manifest format to support Python while remaining valid for Go plugins.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| gRPC over JSON-RPC | Strong typing via protobuf, excellent Python/Go support, streaming for ServeHTTP | — Pending |
| Subprocess per plugin | Matches existing Go model, isolation, simpler than embedded interpreter | — Pending |
| Python first | Most requested language, large ecosystem, good gRPC support | — Pending |

---
*Last updated: 2026-01-13 after initialization*
