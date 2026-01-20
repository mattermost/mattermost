# Phase 2 Plan 01: User and Team API Protos Summary

**Established complete PluginAPI proto skeleton + implemented User/Team method messages.**

## Accomplishments

1. **Created Complete PluginAPI Service Definition**
   - `api.proto` defines `service PluginAPI` with RPCs for all 236 methods from `plugin/api.go`
   - Service definition is mechanically complete and verified by apiverify tool

2. **Split Request/Response Messages into Per-Group Files**
   - `api_user_team.proto`: User, Session, Team, and TeamMember related methods
   - `api_channel_post.proto`: Channel, Post, Emoji, and Sidebar methods
   - `api_kv_config.proto`: KV store, Config, Plugin, and Logging methods
   - `api_file_bot.proto`: File, Upload, and Bot methods
   - `api_remaining.proto`: All other methods (Server, Command, OAuth, Group, etc.)

3. **Created API Parity Verifier Tool**
   - `server/public/pluginapi/grpc/cmd/apiverify/main.go` parses Go AST and proto files
   - Ensures RPC parity between Go API interface and proto service definition
   - Provides clear diff output when methods are missing or extra

4. **Fully Specified User/Team Method Messages**
   - All request/response messages for User/Team methods have complete field definitions
   - Supporting types defined: Status, CustomStatus, UserAuth, Session, UserAccessToken, TeamMemberWithError, TeamStats

5. **Established Response Convention**
   - Every response message has `AppError error = 1` as first field
   - Success payload fields start at field number 2
   - Follows gRPC best practices for error handling

## Files Created/Modified

### Created
- `server/public/pluginapi/grpc/proto/api.proto` - Main PluginAPI service definition
- `server/public/pluginapi/grpc/proto/api_user_team.proto` - User/Team request/response messages
- `server/public/pluginapi/grpc/proto/api_channel_post.proto` - Channel/Post/Emoji messages
- `server/public/pluginapi/grpc/proto/api_kv_config.proto` - KV/Config/Plugin/Logging messages
- `server/public/pluginapi/grpc/proto/api_file_bot.proto` - File/Upload/Bot messages
- `server/public/pluginapi/grpc/proto/api_remaining.proto` - All other method messages
- `server/public/pluginapi/grpc/cmd/apiverify/main.go` - Parity verification tool
- Generated Go files in `server/public/pluginapi/grpc/generated/go/pluginapiv1/`

### Modified
- `server/public/Makefile` - Added proto file mappings for new files
- `server/public/pluginapi/grpc/proto/common.proto` - Added ViewUsersRestrictions type

## Decisions Made

1. **Response-embedded AppError**: Used Response-embedded AppError (field 1) rather than gRPC status codes to preserve full AppError semantics across language boundaries

2. **Per-group proto organization**: Split messages by functional area (User/Team, Channel/Post, KV/Config, File/Bot, Remaining) for maintainability

3. **Type reuse**: Reused existing types from Phase 1 proto files (User, Team, Channel, Post, etc.) rather than duplicating

4. **ViewUsersRestrictions placement**: Moved shared type to common.proto to avoid duplication across files

## Issues Encountered

1. **Duplicate type definitions**: Initially defined types like `Reaction`, `PostList`, and `ViewUsersRestrictions` in multiple files. Resolved by referencing existing definitions or moving to common.proto.

2. **Proto3 map limitations**: Proto3 doesn't support `map<string, repeated T>`. Resolved by creating wrapper message `StringList` for `PostSearchResults.matches`.

## Verification Results

- `make -C server/public proto-gen`: SUCCESS
- `go run ./server/public/pluginapi/grpc/cmd/apiverify`: "OK: All 236 API methods have corresponding RPCs in api.proto"
- No TODO placeholders remain in api_user_team.proto

## Next Step

Ready for `02-02-PLAN.md` - Channel and Post API protobuf message definitions.
