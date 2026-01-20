# Plan 03-01 Summary: Lifecycle/System Hook Protobuf Definitions

**Plan:** 03-01 (Lifecycle hooks)
**Phase:** 03-hook-protobuf-definitions
**Status:** Complete
**Date:** 2026-01-16

## Objective

Define protobuf/gRPC contracts for the lifecycle and system plugin hooks, establishing the baseline `PluginHooks` service and shared hook context types.

## Tasks Completed

### Task 1: Add shared hook context types (PluginContext)
- Created `hooks_common.proto` with `PluginContext` message
- Mirrors `server/public/plugin/context.go` exactly:
  - `session_id` - Session identifier
  - `request_id` - Request correlation ID
  - `ip_address` - Client IP address
  - `accept_language` - Client language preference
  - `user_agent` - Client user agent

### Task 2: Define lifecycle/system hook messages and service
- Created `hooks_lifecycle.proto` with request/response messages for 9 hooks
- Created `hooks.proto` with `PluginHooks` gRPC service
- Updated `server/public/Makefile` to include new proto file mappings

### Task 3: Sanity-check hook coverage
- Verified all 9 lifecycle/system hooks from the plan are covered
- Confirmed field naming follows snake_case convention
- Verified proto generation and Go code compilation

## Hooks Added

| Hook | Go Signature | Notes |
|------|-------------|-------|
| Implemented | `() ([]string, error)` | Returns list of implemented hook names |
| OnActivate | `() error` | Plugin activation event |
| OnDeactivate | `() error` | Plugin deactivation event |
| OnConfigurationChange | `() error` | Configuration change notification |
| OnInstall | `(*Context, OnInstallEvent) error` | Plugin installation event |
| OnSendDailyTelemetry | `()` | Daily telemetry hook (no return) |
| RunDataRetention | `(int64, int64) (int64, error)` | Data retention batch processing |
| OnCloudLimitsUpdated | `(*ProductLimits)` | Cloud limits change (no return) |
| ConfigurationWillBeSaved | `(*Config) (*Config, error)` | Config validation/modification |

## Model Types Added

### Typed Proto Messages
- `OnInstallEvent` - Mirrors `model.OnInstallEvent` (tiny struct, single field)
- `ProductLimits` - Mirrors `model.ProductLimits` (moderate size)
- `FilesLimits` - Uses `google.protobuf.Int64Value` for nullable int64
- `MessagesLimits` - Uses `google.protobuf.Int32Value` for nullable int
- `TeamsLimits` - Uses `google.protobuf.Int32Value` for nullable int

### JSON Blob Wrapper (for volatile/large types)
- `ConfigJson` - Wraps `model.Config` as JSON bytes
  - Rationale: `model.Config` is massive (5000+ lines) and changes frequently
  - JSON serialization avoids maintaining parallel proto schema

## Conventions Established

### Request Context Pattern
- Every request message includes `RequestContext context = 1` as first field
- For hooks with `*plugin.Context`, also include `PluginContext plugin_context = 2`

### Response Error Pattern
- Hooks returning `error`: Response has `AppError error = 1`
- Hooks returning nothing: Response has no error field (failures logged server-side)

### Field Numbering
- Tag 1 reserved for `RequestContext` in requests
- Tag 1 reserved for `AppError` in responses
- Business fields start at tag 2

### Error Handling
- Business errors via response-embedded `AppError` (Phase 1 convention)
- gRPC status codes for transport-level failures only

## Files Modified

- `server/public/pluginapi/grpc/proto/hooks_common.proto` (new)
- `server/public/pluginapi/grpc/proto/hooks_lifecycle.proto` (new)
- `server/public/pluginapi/grpc/proto/hooks.proto` (new)
- `server/public/pluginapi/grpc/generated/go/pluginapiv1/hooks_common.pb.go` (generated)
- `server/public/pluginapi/grpc/generated/go/pluginapiv1/hooks_lifecycle.pb.go` (generated)
- `server/public/pluginapi/grpc/generated/go/pluginapiv1/hooks.pb.go` (generated)
- `server/public/pluginapi/grpc/generated/go/pluginapiv1/hooks_grpc.pb.go` (generated)
- `server/public/Makefile` (updated proto mappings)

## Commits

1. `99f4b588a8` - feat(03-01): add shared hook context types (PluginContext) in hooks_common.proto
2. `8a38e38f0d` - feat(03-01): add lifecycle/system hook RPCs in hooks_lifecycle.proto and hooks.proto

## Verification

- [x] `make proto-gen` - Proto files compile successfully
- [x] `go build ./public/pluginapi/grpc/generated/go/pluginapiv1/...` - Generated Go code compiles

## Deviations

None.

## Notes for Future Plans

- Plans 03-02, 03-03, 03-04 will add more hooks to `hooks.proto` service
- Import new `hooks_*.proto` message files as they are created
- Follow the same request/response conventions established here
