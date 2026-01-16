# Plan 03-04 Summary: Command/WebSocket/Cluster Hook Protobuf Definitions

**Plan:** 03-04 (Command/WebSocket/Cluster hooks)
**Phase:** 03-hook-protobuf-definitions
**Status:** Complete
**Date:** 2026-01-16

## Objective

Define protobuf/gRPC contracts for command, WebSocket, cluster, shared channels, and support hooks.

## Tasks Completed

### Task 1: Create hooks_command.proto
- Created `hooks_command.proto` with request/response messages for all 10 command-related hooks
- Imported shared types from `api_remaining.proto`:
  - `CommandArgs` - slash command arguments
  - `CommandResponse` - slash command response
  - `PluginClusterEvent` - intra-cluster events
- Defined new types specific to hooks:
  - `WebSocketRequest` - WebSocket message from client
  - `SyncMsgJson` - JSON wrapper for complex SyncMsg structure
  - `SyncResponse` - shared channels sync response
  - `RemoteCluster` - remote cluster information

### Task 2: Add remaining hook RPCs
- Updated `hooks.proto` to import `hooks_command.proto`
- Added 10 RPCs across 5 categories:
  - COMMAND HOOKS: 1 RPC
  - WEBSOCKET HOOKS: 3 RPCs
  - CLUSTER HOOKS: 1 RPC
  - SHARED CHANNELS HOOKS: 4 RPCs
  - SUPPORT HOOKS: 1 RPC
- Added note about ServeHTTP/ServeMetrics deferral to Phase 8

### Task 3: Generate and verify
- Updated `Makefile` with `hooks_command.proto` mapping
- `make proto-gen` succeeded
- `go build ./pluginapi/grpc/generated/go/pluginapiv1/...` succeeded

## Hooks Added

| Hook | Go Signature | Category |
|------|-------------|----------|
| ExecuteCommand | `(c *Context, args *model.CommandArgs) (*model.CommandResponse, *model.AppError)` | Command |
| OnWebSocketConnect | `(webConnID, userID string)` | WebSocket |
| OnWebSocketDisconnect | `(webConnID, userID string)` | WebSocket |
| WebSocketMessageHasBeenPosted | `(webConnID, userID string, req *model.WebSocketRequest)` | WebSocket |
| OnPluginClusterEvent | `(c *Context, ev model.PluginClusterEvent)` | Cluster |
| OnSharedChannelsSyncMsg | `(msg *model.SyncMsg, rc *model.RemoteCluster) (model.SyncResponse, error)` | Shared Channels |
| OnSharedChannelsPing | `(rc *model.RemoteCluster) bool` | Shared Channels |
| OnSharedChannelsAttachmentSyncMsg | `(fi *model.FileInfo, post *model.Post, rc *model.RemoteCluster) error` | Shared Channels |
| OnSharedChannelsProfileImageSyncMsg | `(user *model.User, rc *model.RemoteCluster) error` | Shared Channels |
| GenerateSupportData | `(c *Context) ([]*model.FileData, error)` | Support |

## Model Types

**Imported from api_remaining.proto:**
- CommandArgs
- CommandResponse
- PluginClusterEvent

**New types defined in hooks_command.proto:**
- WebSocketRequest - WebSocket client message
- SyncMsgJson - JSON wrapper for model.SyncMsg
- SyncResponse - Shared channels sync response
- RemoteCluster - Remote cluster information

## Deferred to Phase 8

- ServeHTTP (requires HTTP request/response streaming)
- ServeMetrics (requires HTTP request/response streaming)

## Files Modified

- `server/public/pluginapi/grpc/proto/hooks_command.proto` (new)
- `server/public/pluginapi/grpc/proto/hooks.proto` (updated)
- `server/public/Makefile` (updated)
- Generated Go files in `server/public/pluginapi/grpc/generated/go/pluginapiv1/`

## Commits

1. `8261d03e05` - feat(03-04): create hooks_command.proto with command/cluster/websocket hook definitions
2. `0c75338a99` - feat(03-04): add remaining hook RPCs to PluginHooks service
3. `20f7cdebcd` - feat(03-04): update Makefile and generate Go code

## Phase 3 Summary

**Total hooks defined:** 41 RPCs (excluding ServeHTTP/ServeMetrics)
- Lifecycle/System: 9 hooks
- Message: 12 hooks
- User/Channel: 10 hooks
- Command/WebSocket/Cluster/Shared Channels/Support: 10 hooks

**Proto files created in Phase 3:**
- `hooks_common.proto` (shared types: PluginContext)
- `hooks_lifecycle.proto` (lifecycle and system hooks)
- `hooks_message.proto` (message, file, reaction, notification hooks)
- `hooks_user_channel.proto` (user and channel membership hooks)
- `hooks_command.proto` (command, websocket, cluster, shared channels, support hooks)
- `hooks.proto` (PluginHooks service definition with all RPCs)

## Verification

- [x] Proto generation succeeds
- [x] Go code compiles
- [x] hooks_command.proto defines all 10 remaining hooks
- [x] hooks.proto imports hooks_command.proto and has 10 new RPCs
- [x] All model types defined (imported or new)
- [x] Total hook count: 41 RPCs in PluginHooks service

## Next Step

Phase 3 complete. Ready for Phase 4 (Go gRPC Server implementation).
