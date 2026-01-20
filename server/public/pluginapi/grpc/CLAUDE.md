# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with the Mattermost Python plugin gRPC infrastructure.

## Repository Purpose

This directory contains the Go-side gRPC infrastructure enabling Python plugins to communicate with the Mattermost server. It provides:
- Protocol buffer definitions for Plugin API and hooks
- gRPC server implementation for API callbacks
- Type conversion between Go models and protobuf
- ServeHTTP bidirectional streaming

## Key Commands

### Code Generation

```bash
# From server/ directory:

# Generate Go code from proto files
make -C public proto-gen

# Generate both Go and Python code
make -C public proto-gen-all
```

### Testing

```bash
# Run gRPC server tests
go test ./public/pluginapi/grpc/server/... -v

# Run Python supervisor tests
go test ./public/plugin/... -v -run Python

# Run integration tests
go test ./public/pluginapi/grpc/server/... -v -run Integration
```

## Architecture Overview

### Directory Structure

```
server/public/pluginapi/grpc/
├── proto/                    # Protocol buffer definitions
│   ├── common.proto          # Shared types (AppError, StringMap)
│   ├── user.proto            # User type
│   ├── channel.proto         # Channel type
│   ├── post.proto            # Post type
│   ├── team.proto            # Team type
│   ├── file.proto            # File types
│   ├── api.proto             # PluginAPI service definition
│   ├── api_*.proto           # API method groups
│   ├── hooks.proto           # PluginHooks service definition
│   └── hooks_*.proto         # Hook method groups
├── generated/go/pluginapiv1/ # Generated Go code (do not edit)
└── server/                   # gRPC server implementation
    ├── api_server.go         # Server startup and registration
    ├── handlers_*.go         # RPC method handlers
    ├── convert_*.go          # Go model <-> proto conversion
    ├── serve_http.go         # ServeHTTP streaming handler
    └── errors.go             # Error conversion utilities
```

### Key Components

1. **Python Supervisor** (`plugin/python_supervisor.go`)
   - Spawns Python plugin subprocess
   - Sets up go-plugin gRPC connection
   - Passes API server address via env var

2. **Hooks gRPC Client** (`plugin/hooks_grpc_client.go`)
   - Implements `plugin.Hooks` interface
   - Dispatches hooks to Python via gRPC
   - Converts Go types to proto messages

3. **API Server** (`grpc/server/api_server.go`)
   - gRPC server Python plugins connect to
   - Implements PluginAPI service
   - Calls actual `plugin.API` methods

4. **ServeHTTP** (`grpc/server/serve_http.go`)
   - Bidirectional streaming for HTTP
   - 64KB chunks for request/response bodies
   - Handles flush signals

### Proto File Organization

| File | Purpose |
|------|---------|
| `api.proto` | PluginAPI service (all RPC definitions) |
| `api_user_team.proto` | User and Team API messages |
| `api_channel_post.proto` | Channel and Post API messages |
| `api_kv_config.proto` | KV Store and Config messages |
| `api_file_bot.proto` | File and Bot messages |
| `api_remaining.proto` | All other API messages |
| `hooks.proto` | PluginHooks service definition |
| `hooks_*.proto` | Hook messages by category |

## Best Practices

1. **Proto Changes**: Always regenerate Go AND Python code after proto changes
2. **Type Conversion**: Add converters in `convert_*.go` for new types
3. **Error Handling**: Use `ToAppErrorProto`/`FromAppErrorProto` for errors
4. **Testing**: Add tests in `*_test.go` for new handlers
5. **JSON Blobs**: Use `bytes *_json` for complex types (Config, License)

## Adding a New API Method

1. Add RPC to `api.proto` service definition
2. Add request/response messages to appropriate `api_*.proto`
3. Run `make -C public proto-gen-all`
4. Add handler method to appropriate `handlers_*.go`
5. Add conversion functions to `convert_*.go` if new types
6. Add test in `handlers_test.go`
7. Update Python SDK client (see python-sdk/CLAUDE.md)

## Adding a New Hook

1. Add RPC to `hooks.proto` service definition
2. Add request/response messages to appropriate `hooks_*.proto`
3. Run `make -C public proto-gen-all`
4. Add handler in `plugin/hooks_grpc_client.go`
5. Update Python SDK hooks (see python-sdk/CLAUDE.md)

## Common Patterns

### Response-Embedded Errors

All RPC responses include optional `AppError`:

```protobuf
message GetUserResponse {
  User user = 1;
  AppError error = 2;
}
```

Handlers check for errors from API calls and populate the error field:

```go
user, appErr := s.api.GetUser(req.UserId)
if appErr != nil {
    return &pb.GetUserResponse{Error: ToAppErrorProto(appErr)}, nil
}
return &pb.GetUserResponse{User: ToUserProto(user)}, nil
```

### ServeHTTP Streaming

ServeHTTP uses bidirectional streaming with message types:

- `HTTPRequestInit` - Initial request metadata
- `HTTPRequestBody` - Request body chunks
- `HTTPResponseInit` - Response status and headers
- `HTTPResponseBody` - Response body chunks

See `serve_http.go` and `serve_http_test.go` for implementation details.
