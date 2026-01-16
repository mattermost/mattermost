# Plan 03-02 Summary: Message Hook Protobuf Definitions

**Plan:** 03-02 (Message hooks)
**Phase:** 03-hook-protobuf-definitions
**Status:** Complete
**Date:** 2026-01-16

## Objective

Define protobuf/gRPC contracts for message-related plugin hooks including post lifecycle, reactions, file uploads, notifications, and preferences.

## Tasks Completed

### Task 1: Create hooks_message.proto
- Created `hooks_message.proto` with request/response messages for 12 message hooks
- Defined model types specific to message hooks:
  - `EmailNotificationJson` - JSON blob wrapper for complex EmailNotification input
  - `EmailNotificationContent` - typed return for email notification hook
- Reused types from `api_remaining.proto`:
  - `PushNotification` - already defined for SendPushNotification API
  - `Preference` - already defined for preference management APIs

### Task 2: Add message hook RPCs to PluginHooks service
- Added import for `hooks_message.proto`
- Added MESSAGE HOOKS section with 12 RPC definitions
- Each RPC includes documentation explaining:
  - When the hook is called
  - How to use return values (modify, reject, allow)
  - The original Go signature

### Task 3: Update Makefile and generate Go code
- Added `hooks_message.proto` mapping to Makefile
- Successfully ran `make proto-gen`
- Verified Go code compiles with `go build`

## Hooks Added

| Hook | Go Signature | Notes |
|------|-------------|-------|
| MessageWillBePosted | `(c *Context, post *model.Post) (*model.Post, string)` | Can modify/reject posts before save |
| MessageWillBeUpdated | `(c *Context, newPost, oldPost *model.Post) (*model.Post, string)` | Can modify/reject post updates |
| MessageHasBeenPosted | `(c *Context, post *model.Post)` | Notification after post created (void) |
| MessageHasBeenUpdated | `(c *Context, newPost, oldPost *model.Post)` | Notification after post updated (void) |
| MessagesWillBeConsumed | `(posts []*model.Post) []*model.Post` | Filter posts before client delivery (no Context) |
| MessageHasBeenDeleted | `(c *Context, post *model.Post)` | Notification after post deleted (void) |
| FileWillBeUploaded | `(c *Context, info *model.FileInfo, file io.Reader, output io.Writer) (*model.FileInfo, string)` | Can modify/reject uploads (uses bytes for now, Phase 8 adds streaming) |
| ReactionHasBeenAdded | `(c *Context, reaction *model.Reaction)` | Notification after reaction added (void) |
| ReactionHasBeenRemoved | `(c *Context, reaction *model.Reaction)` | Notification after reaction removed (void) |
| NotificationWillBePushed | `(pushNotification *model.PushNotification, userID string) (*model.PushNotification, string)` | Can modify/reject push notifications (no Context) |
| EmailNotificationWillBeSent | `(emailNotification *model.EmailNotification) (*model.EmailNotificationContent, string)` | Can modify/reject email notifications (no Context) |
| PreferencesHaveChanged | `(c *Context, preferences []model.Preference)` | Notification after preferences changed (void) |

## Model Types Added

### New Types in hooks_message.proto
- `EmailNotificationJson` - JSON blob wrapper for complex EmailNotification input type
- `EmailNotificationContent` - Typed proto for email content (subject, title, subtitle, message_html, message_text, button_text, button_url, footer_text)

### Reused Types from api_remaining.proto
- `PushNotification` - Already defined for push notification APIs
- `Preference` - Already defined for preference management APIs

## Files Modified

- `server/public/pluginapi/grpc/proto/hooks_message.proto` (new)
- `server/public/pluginapi/grpc/proto/hooks.proto` (updated - added import and 12 RPCs)
- `server/public/Makefile` (updated - added hooks_message.proto mapping)
- `server/public/pluginapi/grpc/generated/go/pluginapiv1/hooks_message.pb.go` (generated)
- `server/public/pluginapi/grpc/generated/go/pluginapiv1/hooks.pb.go` (regenerated)
- `server/public/pluginapi/grpc/generated/go/pluginapiv1/hooks_grpc.pb.go` (regenerated)

## Commits

1. `ab912b3a2d` - feat(03-02): create hooks_message.proto with message hook definitions
2. `079fd4cd61` - feat(03-02): add message hook RPCs to PluginHooks service
3. `5b3ef59f9a` - feat(03-02): update Makefile and generate Go code for message hooks

## Verification

- [x] `make proto-gen` succeeds in server/public
- [x] `go build ./public/pluginapi/grpc/generated/go/pluginapiv1/...` succeeds
- [x] hooks_message.proto defines all 12 message hooks
- [x] hooks.proto imports hooks_message.proto and has 12 new RPCs
- [x] Model types defined (EmailNotificationJson, EmailNotificationContent)
- [x] Reused existing types (PushNotification, Preference) from api_remaining.proto

## Deviations

- **Minor deviation**: Instead of defining `PushNotification` and `Preference` directly in `hooks_message.proto`, imported them from `api_remaining.proto` where they were already defined. This avoids duplicate type definitions and maintains consistency across the codebase.

## Notes for Future Plans

- FileWillBeUploaded uses bytes for file content; Phase 8 will add streaming support
- Plans 03-03 and 03-04 will add more hooks to the PluginHooks service (user/channel hooks, command/webhook hooks)

## Next Step

Ready for 03-03-PLAN.md (User/Channel hooks)
