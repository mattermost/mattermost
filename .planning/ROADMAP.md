# Roadmap: Mattermost Multi-Language Plugin Support

## Overview

Build a gRPC-based protocol layer enabling Python plugins to communicate with the Mattermost server, achieving full parity with Go plugins. Starting with protocol definitions and Go-side infrastructure, then building the Python SDK and hook system, culminating in manifest support and end-to-end integration testing.

## Domain Expertise

None

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Protocol Foundation** - gRPC setup and protobuf definitions for core types ✓ (2026-01-16)
- [x] **Phase 2: API Protobuf Definitions** - Define all 100+ Plugin API methods in protobuf ✓ (2026-01-16)
- [x] **Phase 3: Hook Protobuf Definitions** - Define all plugin hooks in protobuf ✓ (2026-01-16)
- [x] **Phase 4: Go gRPC Server** - Implement gRPC server wrapping existing Plugin API ✓ (2026-01-16)
- [x] **Phase 5: Python Supervisor** - Go-side process management for Python plugins ✓ (2026-01-19)
- [x] **Phase 6: Python SDK Core** - Basic Python SDK with gRPC client and typed API ✓ (2026-01-19)
- [x] **Phase 7: Python Hook System** - Hook implementation pattern (decorators/class methods) ✓ (2026-01-19)
- [x] **Phase 8: ServeHTTP Streaming** - HTTP request/response streaming over gRPC ✓ (2026-01-19)
- [x] **Phase 9: Manifest Extension** - Extend plugin manifest for Python executables ✓ (2026-01-19)
- [x] **Phase 10: Integration & Testing** - End-to-end testing, example plugin, documentation ✓ (2026-01-19)

## Phase Details

### Phase 1: Protocol Foundation
**Goal**: Establish gRPC infrastructure and define core protobuf types shared across all API methods and hooks
**Depends on**: Nothing (first phase)
**Research**: Likely (gRPC setup patterns, hashicorp/go-plugin integration)
**Research topics**: gRPC with hashicorp/go-plugin, protobuf best practices for large APIs, shared type definitions
**Plans**: TBD

Plans:
- [x] 01-01: gRPC dependency setup and build configuration ✓
- [x] 01-02: Core protobuf types (User, Channel, Post, Team, etc.) ✓
- [x] 01-03: Error handling and common patterns ✓

### Phase 2: API Protobuf Definitions
**Goal**: Complete protobuf definitions for all 100+ Plugin API methods
**Depends on**: Phase 1
**Research**: Unlikely (translating existing Go interfaces to protobuf)
**Plans**: TBD

Plans:
- [x] 02-01: User and Team API methods ✓
- [x] 02-02: Channel and Post API methods ✓
- [x] 02-03: KV Store and Configuration API methods ✓
- [x] 02-04: File and Bot API methods ✓
- [x] 02-05: Remaining API methods (OAuth, Preferences, etc.) ✓

### Phase 3: Hook Protobuf Definitions
**Goal**: Complete protobuf definitions for all plugin hooks
**Depends on**: Phase 1
**Research**: Unlikely (translating existing Go hooks to protobuf)
**Plans**: TBD

Plans:
- [x] 03-01: Lifecycle hooks (OnActivate, OnDeactivate, etc.) ✓
- [x] 03-02: Message hooks (MessagePosted, MessageUpdated, etc.) ✓
- [x] 03-03: User and Channel hooks ✓
- [x] 03-04: Command and Webhook hooks ✓

### Phase 4: Go gRPC Server
**Goal**: Implement Go gRPC server that wraps the existing Plugin API, callable by Python plugins
**Depends on**: Phase 2, Phase 3
**Research**: Unlikely (standard gRPC server implementation)
**Plans**: TBD

Plans:
- [x] 04-01: gRPC server scaffolding and plugin API wrapper ✓
- [x] 04-02: Implement User/Team/Channel API handlers ✓
- [x] 04-03: Implement Post/File/KV Store API handlers ✓
- [x] 04-04: Implement remaining API handlers ✓

### Phase 5: Python Supervisor
**Goal**: Go-side supervisor that spawns Python plugin subprocesses and manages gRPC connections
**Depends on**: Phase 4
**Research**: Likely (process management patterns, gRPC client handshake)
**Research topics**: Python subprocess management from Go, gRPC connection establishment, health checking
**Plans**: TBD

Plans:
- [x] 05-01: Python process spawning and lifecycle management ✓
- [x] 05-02: gRPC connection establishment and handshake ✓
- [x] 05-03: Health checking and restart logic ✓

### Phase 6: Python SDK Core
**Goal**: Python package with typed gRPC client providing access to all Plugin API methods
**Depends on**: Phase 4
**Research**: Likely (grpcio patterns, Python typing best practices)
**Research topics**: grpcio client patterns, Python type hints for generated code, package structure
**Plans**: TBD

Plans:
- [x] 06-01: Python package structure and gRPC client setup ✓
- [x] 06-02: Typed API client for User/Team/Channel methods ✓
- [x] 06-03: Typed API client for Post/File/KV Store methods ✓
- [x] 06-04: Typed API client for remaining methods ✓

### Phase 7: Python Hook System
**Goal**: Pythonic pattern for plugins to implement hooks (decorators or class methods)
**Depends on**: Phase 6
**Research**: Likely (Python decorator patterns for RPC callbacks)
**Research topics**: Python decorator patterns, gRPC bidirectional streaming for callbacks, plugin class structure
**Plans**: TBD

Plans:
- [x] 07-01: Hook registration mechanism design ✓
- [x] 07-02: Implement lifecycle and message hooks ✓
- [x] 07-03: Implement remaining hooks ✓

### Phase 8: ServeHTTP Streaming
**Goal**: Support ServeHTTP hook with proper HTTP request/response streaming over gRPC
**Depends on**: Phase 7
**Research**: Likely (gRPC streaming for HTTP proxy pattern)
**Research topics**: gRPC streaming for HTTP bodies, request/response header handling, chunked transfer
**Plans**: TBD

Plans:
- [x] 08-01: HTTP request streaming from Go to Python ✓
- [x] 08-02: HTTP response streaming from Python to Go ✓

### Phase 9: Manifest Extension
**Goal**: Extend plugin manifest format to support Python executables and entry points
**Depends on**: Phase 5
**Research**: Unlikely (extending existing JSON/YAML manifest format)
**Plans**: TBD

Plans:
- [x] 09-01: Manifest schema extension for Python plugins ✓
- [x] 09-02: Manifest parsing and validation updates ✓

### Phase 10: Integration & Testing
**Goal**: End-to-end testing with example Python plugin, performance benchmarks, documentation
**Depends on**: Phase 8, Phase 9
**Research**: Unlikely (testing and documentation)
**Plans**: TBD

Plans:
- [x] 10-01: Example Python plugin implementation ✓
- [x] 10-02: Integration test suite ✓
- [x] 10-03: Performance benchmarks and documentation ✓

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9 → 10

Note: Phase 2 and 3 can run in parallel (both depend only on Phase 1).
Note: Phase 5, 6, and 9 can partially overlap (all depend on Phase 4).

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Protocol Foundation | 3/3 | Complete | 2026-01-16 |
| 2. API Protobuf Definitions | 5/5 | Complete | 2026-01-16 |
| 3. Hook Protobuf Definitions | 4/4 | Complete | 2026-01-16 |
| 4. Go gRPC Server | 4/4 | Complete | 2026-01-16 |
| 5. Python Supervisor | 3/3 | Complete | 2026-01-19 |
| 6. Python SDK Core | 4/4 | Complete | 2026-01-19 |
| 7. Python Hook System | 3/3 | Complete | 2026-01-19 |
| 8. ServeHTTP Streaming | 2/2 | Complete | 2026-01-19 |
| 9. Manifest Extension | 2/2 | Complete | 2026-01-19 |
| 10. Integration & Testing | 3/3 | Complete | 2026-01-19 |
