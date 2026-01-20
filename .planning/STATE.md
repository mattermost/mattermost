# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-01-13)

**Core value:** Full API coverage: every API method and hook available to Go plugins must work identically from Python plugins.
**Current focus:** Phase 12 — Python API Callback Server

## Current Position

Phase: 12 of 12 (Python API Callback Server) - COMPLETE
Plan: 1 of 1 in current phase
Status: All phases complete
Last activity: 2026-01-20 — Completed 12-01-PLAN.md (Python API Callback Server)

Progress: ██████████████████████████████ 100% (12/12 phases complete)

## Performance Metrics

**Velocity:**
- Total plans completed: 36 (3 in Phase 1, 5 in Phase 2, 4 in Phase 3, 4 in Phase 4, 3 in Phase 5, 4 in Phase 6, 3 in Phase 7, 2 in Phase 8, 2 in Phase 9, 3 in Phase 10, 3 in Phase 11)
- Average duration: ~11 min
- Total execution time: ~8 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 1. Protocol Foundation | 3/3 | ~45 min | ~15 min |
| 2. API Protobuf Definitions | 5/5 | ~30 min | ~6 min* |
| 3. Hook Protobuf Definitions | 4/4 | ~30 min | ~8 min |
| 4. Go gRPC Server | 4/4 | ~60 min | ~15 min |
| 5. Python Supervisor | 3/3 | ~30 min | ~10 min |
| 6. Python SDK Core | 4/4 | ~45 min | ~11 min |
| 7. Python Hook System | 3/3 | ~45 min | ~15 min |
| 8. ServeHTTP Streaming | 2/2 | ~30 min | ~15 min |
| 9. Manifest Extension | 2/2 | ~16 min | ~8 min |
| 10. Integration & Testing | 3/3 | ~30 min | ~10 min |
| 11. Server Integration | 3/3 | ~45 min | ~15 min |

*Note: Phase 2 plans 02-02 through 02-05 were effectively completed by 02-01 which implemented all message definitions.

**Final Status:**
- All 36 plans across 11 phases completed
- Full API parity achieved (236 RPC methods)
- Full hook parity achieved (35+ hooks)
- Example plugin, integration tests, benchmarks, and documentation delivered
- Python plugins fully integrated into Mattermost server

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

| Phase | Decision | Rationale |
|-------|----------|-----------|
| 02-01 | Complete message definitions in skeleton | Avoided placeholder churn; all 236 RPCs defined |
| 02-01 | Per-group proto files | Maintainability: api_user_team, api_channel_post, api_kv_config, api_file_bot, api_remaining |
| 02-01 | JSON blob for large types | Config, License, Manifest use bytes *_json to avoid proto churn |
| 03-01 | PluginContext message | Shared context type for all hook invocations |
| 03-02 | Reuse types from api_remaining.proto | Avoided duplicate definitions for PushNotification, Preference |
| 03-04 | Reuse types from api_remaining.proto | Avoided duplicates for CommandArgs, CommandResponse, SlackAttachment |
| 04-01 | Domain-split handler files | Maintainability: handlers_user.go, handlers_team.go, etc. |
| 04-02 | Conversion helpers per domain | convert_team.go, convert_post.go, convert_file.go, etc. |
| 04-04 | 70+ RPC handlers for remaining APIs | Full API parity achieved on Go server side |
| 05-02 | Fake Python interpreter pattern | Go binaries simulating Python for hermetic tests |
| 05-03 | Failure-mode tests (timeout, invalid handshake) | Resilient supervisor with proper error handling |
| 06-02 | Domain-specific mixin classes | UsersMixin, TeamsMixin, ChannelsMixin for organization |
| 06-03 | Frozen wrapper dataclasses | from_proto()/to_proto() for type conversion |
| 06-04 | 8 new mixin modules for remaining APIs | BotsMixin, CommandsMixin, ConfigMixin, etc. |
| 06-04 | 100% RPC coverage (236/236) | Full parity with Go Plugin API |
| 07-01 | @hook decorator + HookName enum | Pythonic hook registration pattern |
| 07-01 | Plugin base class with __init_subclass__ | Automatic hook discovery at class definition |
| 07-01 | gRPC health service for go-plugin | Reports "plugin" service as SERVING |
| 07-02 | Hook servicer with lifecycle/message hooks | OnActivate, MessageWillBePosted, etc. |
| 07-02 | DISMISS_POST_ERROR constant | Matches Go constant for silent post dismissal |
| 07-03 | 30+ remaining hooks implemented | Full hook parity excluding streaming hooks |
| 07-03 | Streaming hooks deferred to Phase 8 | ServeHTTP, ServeMetrics, FileWillBeUploaded |
| 08-01 | Bidirectional streaming for ServeHTTP | Request/response bodies chunked at 64KB |
| 08-01 | HTTPRequest/HTTPResponseWriter pattern | Matches Go http.Handler(w, r) semantics |
| 08-02 | Flush support as gRPC message flag | Best-effort flush, no-op when unsupported |
| 08-02 | Status code validation 100-999 | Invalid codes return 500, matches plugin/http.go |
| 09-01 | Runtime field with empty default | Backward compatible - Go plugins don't need to specify |
| 09-01 | ManifestPython as pointer | Allows nil check for non-Python plugins |
| 09-02 | Server.Runtime over .py extension | Explicit declaration preferred, extension is fallback |
| 09-02 | Removed props.runtime hack | No longer needed with proper manifest fields |
| 11-01 | hooksGRPCClient adapter pattern | Mirror hooksRPCClient but for gRPC; implements Hooks interface |
| 11-01 | 64KB chunks for ServeHTTP | Consistent with Phase 8 streaming design |
| 11-02 | Extract gRPC conn from GRPCClient.Conn | go-plugin exposes underlying connection |
| 11-02 | Fake Python interpreters for tests | Go binaries implementing PluginHooks gRPC for hermetic tests |

### Deferred Issues

| Issue | Phase | Notes |
|-------|-------|-------|
| Streaming for UploadData/InstallPlugin | 02-04 | Currently unary with bytes; should be client-streaming for large files |
| HTTP body streaming | 02-05 | PluginHTTP uses unary bytes; Phase 8 will add streaming |
| ServeHTTP/ServeMetrics | 03-04 | Deferred to Phase 8 (HTTP streaming) |
| GetPluginID needs supervisor context | 04-04 | Returns Unimplemented; requires Phase 5 integration |

### Blockers/Concerns

None.

## Session Continuity

Last session: 2026-01-19
Stopped at: Completed Phase 11 (Server Integration) — All phases complete
Resume file: None

## Roadmap Evolution

- Phase 12 added: Python API Callback Server (2026-01-20)
  - Reason: During real-world testing, discovered Python plugins cannot call back to Go API
  - Python → Go API calls fail with "Connection refused" because no gRPC server is running
  - Existing APIServer implementation at `server/public/pluginapi/grpc/server/` can be reused

## Next Steps

**Phase 12: Python API Callback Server**

This phase will enable Python plugins to make API calls back to the Go server:
1. Start gRPC PluginAPI server when Python plugin launches
2. Pass server address to Python via `MATTERMOST_PLUGIN_API_TARGET` env var
3. Test end-to-end with `/hello` command registration

Run `/gsd:plan-phase 12` to create detailed implementation plan.
