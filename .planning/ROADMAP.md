# Roadmap: Mattermost Multi-Language Plugin Support

## Overview

Build a gRPC-based protocol layer enabling Python plugins to communicate with the Mattermost server, achieving full parity with Go plugins. Starting with protocol definitions and Go-side infrastructure, then building the Python SDK and hook system, culminating in manifest support and end-to-end integration testing.

## Domain Expertise

None

## Milestones

- ✅ **[v1.0 Python Plugin Support](milestones/v1.0-ROADMAP.md)** — Phases 1-13 (shipped 2026-01-20)
- ✅ **v1.1 LangChain Agent Demo** — Phases 14-18 (shipped 2026-01-20)

## Completed Milestones

<details>
<summary>✅ v1.0 Python Plugin Support (Phases 1-13) — SHIPPED 2026-01-20</summary>

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
- [x] **Phase 11: Server Integration** - Wire Python plugins into main server plugin loading path ✓ (2026-01-19)
- [x] **Phase 12: Python API Callback Server** - gRPC server for Python plugins to call back to Go API ✓ (2026-01-20)
- [x] **Phase 13: Python Plugin Developer Experience** - Architecture docs, Makefile tooling, Claude.md guides ✓ (2026-01-20)

**Key accomplishments:**
- 236 RPC methods for Plugin API
- 35+ hooks including ServeHTTP streaming
- Python SDK with typed client and decorator-based hooks
- Full server integration with hooksGRPCClient adapter
- Comprehensive documentation and tooling

</details>

### ✅ v1.1 LangChain Agent Demo (Complete)

**Milestone Goal:** Demonstrate Python ecosystem advantages by building an AI agent plugin with LangChain, showcasing capabilities to internal engineers
**Shipped:** 2026-01-20

#### Phase 14: Bot Infrastructure ✓

**Goal**: Create two bots (OpenAI, Anthropic) on plugin activation, handle DM message routing
**Depends on**: v1.0 complete
**Completed**: 2026-01-20

Plans:
- [x] 14-01: Bot Infrastructure (plugin structure, bot creation, DM routing)

#### Phase 15: LangChain Core ✓

**Goal**: Basic LangChain setup with OpenAI/Anthropic providers, simple chat responses
**Depends on**: Phase 14
**Research**: Complete (15-RESEARCH.md)
**Plans**: 1 plan
**Completed**: 2026-01-20

Plans:
- [x] 15-01: LangChain integration with real LLM responses

#### Phase 16: Session Memory ✓

**Goal**: Multi-turn conversations via Mattermost threading as conversation history
**Depends on**: Phase 15
**Research**: None needed (using existing SDK APIs)
**Plans**: 1 plan
**Completed**: 2026-01-20

Plans:
- [x] 16-01: Threading and conversation history from threads

#### Phase 17: MCP Client ✓

**Goal**: Model Context Protocol integration for external tools (HTTP/SSE and STDIO servers)
**Depends on**: Phase 16
**Research**: Complete (17-RESEARCH.md)
**Plans**: 1 plan
**Completed**: 2026-01-20

Plans:
- [x] 17-01: MCP client initialization and async agent handlers

#### Phase 18: Agentic Loop ✓

**Goal**: Tool calling orchestration, reasoning, multi-step execution with LangChain agents
**Depends on**: Phase 17
**Research**: Complete (18-RESEARCH.md)
**Plans**: 1 plan
**Completed**: 2026-01-20

Plans:
- [x] 18-01: Recursion limit, extended thinking, tenacity retry

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Protocol Foundation | v1.0 | 3/3 | Complete | 2026-01-16 |
| 2. API Protobuf Definitions | v1.0 | 5/5 | Complete | 2026-01-16 |
| 3. Hook Protobuf Definitions | v1.0 | 4/4 | Complete | 2026-01-16 |
| 4. Go gRPC Server | v1.0 | 4/4 | Complete | 2026-01-16 |
| 5. Python Supervisor | v1.0 | 3/3 | Complete | 2026-01-19 |
| 6. Python SDK Core | v1.0 | 4/4 | Complete | 2026-01-19 |
| 7. Python Hook System | v1.0 | 3/3 | Complete | 2026-01-19 |
| 8. ServeHTTP Streaming | v1.0 | 2/2 | Complete | 2026-01-19 |
| 9. Manifest Extension | v1.0 | 2/2 | Complete | 2026-01-19 |
| 10. Integration & Testing | v1.0 | 3/3 | Complete | 2026-01-19 |
| 11. Server Integration | v1.0 | 3/3 | Complete | 2026-01-19 |
| 12. Python API Callback Server | v1.0 | 1/1 | Complete | 2026-01-20 |
| 13. Python Plugin Developer Experience | v1.0 | 4/4 | Complete | 2026-01-20 |
| 14. Bot Infrastructure | v1.1 | 1/1 | Complete | 2026-01-20 |
| 15. LangChain Core | v1.1 | 1/1 | Complete | 2026-01-20 |
| 16. Session Memory | v1.1 | 1/1 | Complete | 2026-01-20 |
| 17. MCP Client | v1.1 | 1/1 | Complete | 2026-01-20 |
| 18. Agentic Loop | v1.1 | 1/1 | Complete | 2026-01-20 |
