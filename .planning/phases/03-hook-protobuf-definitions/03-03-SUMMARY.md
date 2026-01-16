# Plan 03-03 Summary: User/Channel Hook Protobuf Definitions

**Plan:** 03-03 (User/Channel hooks)
**Phase:** 03-hook-protobuf-definitions
**Status:** Complete
**Date:** 2026-01-16

## Objective

Define protobuf/gRPC contracts for user and channel lifecycle hooks including user creation, login, deactivation, SAML, and channel/team membership changes.

## Tasks Completed

### Task 1: Create hooks_user_channel.proto
- Created new proto file with request/response message definitions for all 10 user/channel hooks
- Defined `SamlAssertionInfoJson` type for handling external SAML library types (JSON blob approach)
- Used `optional User actor` for membership hooks where the actor can be nil (self-join/leave)
- Followed conventions from 03-01: `RequestContext context = 1`, `PluginContext plugin_context = 2`

### Task 2: Add user/channel hook RPCs
- Added import for hooks_user_channel.proto in hooks.proto
- Added USER HOOKS section with 5 RPCs
- Added CHANNEL AND TEAM HOOKS section with 5 RPCs
- Updated comment in header to reflect hooks_user_channel.proto status

### Task 3: Generate and verify
- Updated Makefile with hooks_user_channel.proto mappings for both go_opt and go-grpc_opt
- Ran `make proto-gen` successfully
- Verified `go build ./pluginapi/grpc/generated/go/pluginapiv1/...` succeeds

## Hooks Added

| Hook | Go Signature | Response | Notes |
|------|-------------|----------|-------|
| UserHasBeenCreated | `(c *Context, user *model.User)` | Void | Notification hook |
| UserWillLogIn | `(c *Context, user *model.User) string` | rejection_reason | Can reject login |
| UserHasLoggedIn | `(c *Context, user *model.User)` | Void | Notification hook |
| UserHasBeenDeactivated | `(c *Context, user *model.User)` | Void | Notification hook |
| OnSAMLLogin | `(c *Context, user *model.User, assertion *saml2.AssertionInfo) error` | AppError | JSON blob for SAML assertion |
| ChannelHasBeenCreated | `(c *Context, channel *model.Channel)` | Void | Notification hook |
| UserHasJoinedChannel | `(c *Context, channelMember *model.ChannelMember, actor *model.User)` | Void | Optional actor |
| UserHasLeftChannel | `(c *Context, channelMember *model.ChannelMember, actor *model.User)` | Void | Optional actor |
| UserHasJoinedTeam | `(c *Context, teamMember *model.TeamMember, actor *model.User)` | Void | Optional actor |
| UserHasLeftTeam | `(c *Context, teamMember *model.TeamMember, actor *model.User)` | Void | Optional actor |

## Model Types Added

- **SamlAssertionInfoJson**: JSON blob wrapper for saml2.AssertionInfo (external library type)
  - Uses `bytes assertion_json = 1` to avoid proto dependency on external SAML library
  - Go server serializes via json.Marshal, Python can deserialize as needed

## Files Modified

- `server/public/pluginapi/grpc/proto/hooks_user_channel.proto` (new - 284 lines)
- `server/public/pluginapi/grpc/proto/hooks.proto` (updated - added import and 10 RPCs)
- `server/public/Makefile` (updated - added proto mapping)
- `server/public/pluginapi/grpc/generated/go/pluginapiv1/hooks_user_channel.pb.go` (generated)
- `server/public/pluginapi/grpc/generated/go/pluginapiv1/hooks.pb.go` (regenerated)
- `server/public/pluginapi/grpc/generated/go/pluginapiv1/hooks_grpc.pb.go` (regenerated)

## Commits

1. `e6c343c72b` - feat(03-03): create hooks_user_channel.proto with user/channel hook definitions
2. `6f4a0fe8c9` - feat(03-03): add user/channel hook RPCs to PluginHooks service
3. `8bbc01cca2` - feat(03-03): update Makefile and generate Go code for user/channel hooks

## Verification

- [x] `make proto-gen` succeeds in server/public
- [x] `go build ./pluginapi/grpc/generated/go/pluginapiv1/...` succeeds
- [x] hooks_user_channel.proto defines all 10 user/channel hooks
- [x] hooks.proto imports hooks_user_channel.proto and has 10 new RPCs
- [x] SamlAssertionInfoJson type defined for SAML assertion

## Next Step

Ready for 03-04-PLAN.md (Command/WebSocket/Cluster hooks)
