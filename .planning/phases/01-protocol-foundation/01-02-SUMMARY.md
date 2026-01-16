# Phase 01-02 Summary: Core Protobuf Types

## Status: COMPLETE

## Objective
Define core protobuf message types (User, Channel, Post, Team, FileInfo) shared across all future Plugin API methods and hooks, preserving Mattermost semantics for eventual full parity with Go plugins.

## Tasks Completed

### Discovery (L1-L3)
- **L1**: Confirmed 01-01 output (make proto-gen works from server/ directory)
- **L2**: Enumerated 65+ model types from api.go and hooks.go
- **L2**: Identified dynamic JSON fields:
  - `User.Props`, `User.NotifyProps`, `User.Timezone` -> `map<string, string>`
  - `Post.Props`, `Channel.Props` -> `google.protobuf.Struct`
- **L3**: Selected Phase 1 core subset: User, Channel, Post, Team, FileInfo

### Proto File Creation

| File | Messages/Enums | Description |
|------|----------------|-------------|
| `common.proto` | Empty, StringMap, AppError | Shared building blocks |
| `user.proto` | User | 34 fields mirroring model.User |
| `channel.proto` | Channel, ChannelType, ChannelBannerInfo | Full channel representation |
| `post.proto` | Post, PostMetadata, PostEmbed, PostImage, PostPriority, PostAcknowledgement, Reaction, PostList | Complete post ecosystem |
| `team.proto` | Team, TeamMember, TeamUnread, TeamType | Team and membership types |
| `file.proto` | FileInfo, FileUploadResponse, FileData | File handling types |

### Key Design Decisions
1. **Timestamps**: All `*_at` fields are `int64` (milliseconds since epoch)
2. **IDs**: All IDs are `string` (26-char base32)
3. **Dynamic JSON**: Used `google.protobuf.Struct` for arbitrary JSON data
4. **String maps**: Used `map<string, string>` for User props/notify_props/timezone
5. **Import hierarchy**: file.proto is imported by post.proto to avoid duplication
6. **Removed bootstrap.proto**: Replaced with common.proto

### Build System Updates
- Updated Makefile with `PROTO_GO_PKG` variable
- Added M-mappings for all proto files (common, user, channel, post, team, file)
- Proto generation works cleanly from server/ directory

## Verification
- `make proto-gen` succeeds without warnings
- `go build ./...` in server/public succeeds
- Generated Go packages import correctly

## Files Modified/Created

### New Proto Files
- `server/public/pluginapi/grpc/proto/common.proto`
- `server/public/pluginapi/grpc/proto/user.proto`
- `server/public/pluginapi/grpc/proto/channel.proto`
- `server/public/pluginapi/grpc/proto/post.proto`
- `server/public/pluginapi/grpc/proto/team.proto`
- `server/public/pluginapi/grpc/proto/file.proto`

### New Generated Go Files
- `server/public/pluginapi/grpc/generated/go/pluginapiv1/common.pb.go`
- `server/public/pluginapi/grpc/generated/go/pluginapiv1/user.pb.go`
- `server/public/pluginapi/grpc/generated/go/pluginapiv1/channel.pb.go`
- `server/public/pluginapi/grpc/generated/go/pluginapiv1/post.pb.go`
- `server/public/pluginapi/grpc/generated/go/pluginapiv1/team.pb.go`
- `server/public/pluginapi/grpc/generated/go/pluginapiv1/file.pb.go`

### Removed Files
- `server/public/pluginapi/grpc/proto/bootstrap.proto`
- `server/public/pluginapi/grpc/generated/go/pluginapiv1/bootstrap.pb.go`

### Updated Files
- `server/public/Makefile` (added proto file mappings)

## Commit
- `ca57bca5a2`: feat(01-02): add core protobuf types (User, Channel, Post, Team, FileInfo)

## Deviations
- None

## Notes for Future Plans
- Additional types (Bot, Command, etc.) can be added in Phase 2/3 as needed
- The Reaction type is defined in post.proto but may need to be extracted if used elsewhere
- Consider adding ChannelMember type in a future plan if needed for API methods
