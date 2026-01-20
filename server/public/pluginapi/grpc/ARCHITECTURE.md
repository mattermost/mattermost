# Python Plugin gRPC Architecture

This document describes the architecture of the Mattermost Python plugin system, which enables server-side plugins written in Python to have full API parity with Go plugins.

## Overview

### Purpose

The Python plugin system extends Mattermost's existing plugin infrastructure to support plugins written in languages beyond Go. It uses gRPC with Protocol Buffers for language-agnostic communication while maintaining the subprocess-per-plugin model and seamless integration with the existing plugin infrastructure.

### Key Value Proposition

**Full API parity**: Every API method and hook available to Go plugins works identically from Python plugins. Python plugins can:
- Receive all server hooks (message events, user events, HTTP requests, etc.)
- Call all 100+ Plugin API methods (users, channels, posts, KV store, etc.)
- Handle HTTP requests via bidirectional streaming

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           Mattermost Server                                 │
│                                                                             │
│  ┌──────────────┐    ┌─────────────────┐    ┌────────────────────────────┐ │
│  │   App Layer  │───▶│   Plugin Env    │───▶│   Python Supervisor        │ │
│  │              │    │ (environment.go)│    │  (python_supervisor.go)    │ │
│  └──────────────┘    └─────────────────┘    └────────────────────────────┘ │
│                             │                           │                   │
│                             ▼                           ▼                   │
│                      ┌─────────────────┐    ┌────────────────────────────┐ │
│                      │ hooksGRPCClient │    │   PluginAPI gRPC Server    │ │
│                      │ (hook dispatch) │    │   (api_server.go)          │ │
│                      └────────┬────────┘    └────────────┬───────────────┘ │
│                               │                          │                  │
└───────────────────────────────┼──────────────────────────┼──────────────────┘
                                │ gRPC                     │ gRPC
                   Hooks call   │                          │  API calls
                   (Server→Plugin)                         │  (Plugin→Server)
                                ▼                          ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         Python Plugin Process                               │
│                                                                             │
│  ┌────────────────────┐    ┌─────────────────┐    ┌─────────────────────┐  │
│  │  PluginHooks       │    │   Plugin Class  │    │   API Client        │  │
│  │  gRPC Server       │◀───│   (user code)   │───▶│   (calls Go API)    │  │
│  │  (server.py)       │    │   (plugin.py)   │    │   (client.py)       │  │
│  └────────────────────┘    └─────────────────┘    └─────────────────────┘  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Component Layers

### Protocol Layer

Protocol Buffer definitions define the contract between Go and Python:

| File | Purpose |
|------|---------|
| `proto/api.proto` | Main PluginAPI service definition (100+ methods) |
| `proto/hooks.proto` | PluginHooks service definition (30+ hooks) |
| `proto/api_user_team.proto` | User and team API message types |
| `proto/api_channel_post.proto` | Channel, post, emoji message types |
| `proto/api_kv_config.proto` | KV store, config, logging message types |
| `proto/api_file_bot.proto` | File and bot message types |
| `proto/api_remaining.proto` | Server, command, preference, group, and other types |
| `proto/hooks_lifecycle.proto` | Lifecycle hook messages (OnActivate, etc.) |
| `proto/hooks_message.proto` | Message hook messages (MessageWillBePosted, etc.) |
| `proto/hooks_user_channel.proto` | User and channel hook messages |
| `proto/hooks_command.proto` | Command, WebSocket, cluster hook messages |
| `proto/hooks_http.proto` | HTTP streaming hook messages (ServeHTTP) |
| `proto/types.proto` | Shared model types (User, Post, Channel, etc.) |

### Go Infrastructure Layer

#### Python Supervisor (`server/public/plugin/python_supervisor.go`)

Manages Python plugin process lifecycle:

- **Runtime Detection**: Detects Python plugins via `manifest.Server.Runtime == "python"` or `.py` extension
- **Interpreter Discovery**: Finds Python interpreter (venv-first, then system PATH)
- **Process Spawning**: Creates exec.Cmd with proper working directory
- **API Server Startup**: Starts gRPC PluginAPI server before subprocess
- **Environment Setup**: Sets `MATTERMOST_PLUGIN_API_TARGET` env var with server address
- **Graceful Shutdown**: 5-second WaitDelay for graceful termination

Key functions:
```go
func isPythonPlugin(manifest *model.Manifest) bool
func findPythonInterpreter(pluginDir string) (string, error)
func startAPIServer(apiImpl API, registrar APIServerRegistrar) (string, func(), error)
func configurePythonCommand(pluginInfo *model.BundleInfo, ...) error
```

#### Hooks gRPC Client (`server/public/plugin/hooks_grpc_client.go`)

Dispatches hook invocations to Python plugins:

- **Hook Registry**: Queries `Implemented()` RPC to know which hooks the plugin handles
- **Hook Dispatch**: Calls appropriate gRPC method for each hook type
- **Timeout Management**: 30-second default timeout per hook call
- **Bidirectional Streaming**: Handles ServeHTTP with request/response streaming
- **Model Conversion**: Converts between model types and proto messages

Key type:
```go
type hooksGRPCClient struct {
    client      pb.PluginHooksClient
    implemented [TotalHooksID]bool
    log         *mlog.Logger
}
```

#### API Server (`server/public/pluginapi/grpc/server/api_server.go`)

gRPC server that Python plugins call back to:

- **API Wrapping**: Wraps the plugin.API interface for gRPC access
- **Method Implementations**: Each RPC delegates to corresponding API method
- **Error Conversion**: Converts model.AppError to response-embedded errors (not gRPC status)
- **Registration**: `Register(grpcServer, apiImpl)` registers the service

Key type:
```go
type APIServer struct {
    pb.UnimplementedPluginAPIServer
    impl plugin.API
}
```

#### ServeHTTP Handler (`server/public/pluginapi/grpc/server/serve_http.go`)

Handles bidirectional HTTP streaming:

- **64KB Chunking**: Streams request/response bodies in 64KB chunks
- **Early Response**: Plugin can respond before request body is fully sent
- **Cancellation**: HTTP client disconnect propagates via gRPC context
- **Status Code Validation**: Protects against invalid status codes (100-999 range)
- **Flush Support**: Best-effort flushing when ResponseWriter supports Flusher

Constants:
```go
const DefaultChunkSize = 64 * 1024  // 64KB
```

### Python SDK Layer

#### Plugin Base Class (`python-sdk/src/mattermost_plugin/plugin.py`)

Base class for plugin authors:

- **`__init_subclass__`**: Auto-discovers @hook decorated methods at class definition time
- **Hook Registry**: Builds class-level `_hook_registry` mapping hook names to handlers
- **API Access**: Provides `self.api` property for making API calls
- **Logging**: Provides `self.logger` for plugin logging

```python
class Plugin:
    _hook_registry: Dict[str, Callable[..., Any]] = {}

    def __init_subclass__(cls, **kwargs):
        # Discover @hook decorated methods

    @classmethod
    def implemented_hooks(cls) -> List[str]:
        # Returns list of hook names for Implemented() RPC
```

#### Hook System (`python-sdk/src/mattermost_plugin/hooks.py`)

Decorator-based hook registration:

- **`@hook` Decorator**: Marks methods as hook handlers
- **`HookName` Enum**: All 30+ canonical hook names matching Go
- **Validation**: Rejects unknown hook names at decoration time
- **Async Support**: Handles both sync and async handlers

```python
class HookName(str, Enum):
    OnActivate = "OnActivate"
    MessageWillBePosted = "MessageWillBePosted"
    ServeHTTP = "ServeHTTP"
    # ... 30+ hooks

@hook(HookName.OnActivate)
def on_activate(self) -> None:
    pass
```

#### API Client (`python-sdk/src/mattermost_plugin/client.py`)

Typed client for calling Mattermost API:

- **Context Manager**: `with PluginAPIClient() as client:`
- **Mixin Architecture**: Organized by API domain (users, teams, channels, etc.)
- **Error Handling**: Converts gRPC errors and AppErrors to SDK exceptions
- **Type Safety**: Full type hints for all methods

```python
class PluginAPIClient(
    UsersMixin,
    TeamsMixin,
    ChannelsMixin,
    PostsMixin,
    # ... more mixins
):
    def get_server_version(self) -> str: ...
    def get_user(self, user_id: str) -> User: ...
```

#### gRPC Server (`python-sdk/src/mattermost_plugin/server.py`)

Plugin-side gRPC server for receiving hooks:

- **Async Server**: Uses grpc.aio for async gRPC
- **Health Service**: Registers grpc.health.v1.Health for go-plugin
- **Handshake**: Outputs go-plugin handshake line to stdout
- **Signal Handling**: Graceful shutdown on SIGTERM/SIGINT

```python
async def serve_plugin(plugin_class: Type[Plugin]) -> None:
    # 1. Load runtime config from environment
    # 2. Create and connect API client
    # 3. Instantiate plugin
    # 4. Start gRPC server with health service
    # 5. Output handshake line
    # 6. Wait for termination
```

## Process Lifecycle

### Plugin Loading Sequence

```
┌──────────────────┐
│ 1. Manifest Parse│  Server reads plugin.json, detects runtime="python"
└────────┬─────────┘
         ▼
┌──────────────────┐
│ 2. API Server    │  Start gRPC PluginAPI server on random port
│    Startup       │  Store cleanup function for shutdown
└────────┬─────────┘
         ▼
┌──────────────────┐
│ 3. Python Process│  python_supervisor.go builds exec.Cmd:
│    Spawn         │  - Find Python interpreter (venv-first)
│                  │  - Set MATTERMOST_PLUGIN_API_TARGET env var
│                  │  - Set working directory to plugin path
└────────┬─────────┘
         ▼
┌──────────────────┐
│ 4. go-plugin     │  Wait for handshake line on stdout:
│    Handshake     │  "1|1|tcp|127.0.0.1:PORT|grpc"
│                  │  Health check confirms plugin is serving
└────────┬─────────┘
         ▼
┌──────────────────┐
│ 5. Implemented() │  Query which hooks the plugin implements
│    RPC           │  Populate implemented[] array for optimization
└────────┬─────────┘
         ▼
┌──────────────────┐
│ 6. OnActivate()  │  Call OnActivate hook if implemented
│    Hook          │  Plugin can initialize, register commands
└────────┬─────────┘
         ▼
┌──────────────────┐
│ 7. Running       │  Plugin is now active and receiving hooks
└──────────────────┘
```

### Environment Variables

| Variable | Set By | Used By | Purpose |
|----------|--------|---------|---------|
| `MATTERMOST_PLUGIN_API_TARGET` | Go Supervisor | Python Client | gRPC address for API calls |
| `MATTERMOST_PLUGIN_ID` | Go Supervisor | Python SDK | Plugin identifier |
| `MATTERMOST_LOG_LEVEL` | Go Supervisor | Python SDK | Logging level configuration |

### Shutdown Sequence

```
┌──────────────────┐
│ 1. OnDeactivate()│  Server calls OnDeactivate hook
└────────┬─────────┘
         ▼
┌──────────────────┐
│ 2. gRPC Client   │  Close gRPC connection to plugin
│    Close         │
└────────┬─────────┘
         ▼
┌──────────────────┐
│ 3. Process       │  Send termination signal, wait 5 seconds
│    Termination   │  (cmd.WaitDelay = 5 * time.Second)
└────────┬─────────┘
         ▼
┌──────────────────┐
│ 4. API Server    │  Call apiServerCleanup() for graceful stop
│    Shutdown      │  GracefulStop() drains pending requests
└──────────────────┘
```

## Communication Flow

### Hook Dispatch (Server to Plugin)

```
   Go Server                                     Python Plugin
       │                                              │
       │  ╔═══════════════════════════════════════╗   │
       │  ║  Hook Event (e.g., MessageWillBePosted) ║   │
       │  ╚═══════════════════════════════════════╝   │
       │                                              │
       ├──────────────────────────────────────────────►
       │           gRPC: MessageWillBePosted          │
       │           (context, post proto)              │
       │                                              │
       │                                     ┌────────┤
       │                                     │ Plugin │
       │                                     │ @hook  │
       │                                     │ handler│
       │                                     └────────┤
       │                                              │
       ◄──────────────────────────────────────────────┤
       │           Response                           │
       │           (modified_post, rejection_reason)  │
       │                                              │
```

### API Call (Plugin to Server)

```
   Python Plugin                                 Go Server
       │                                              │
       │  ╔═══════════════════════════════════════╗   │
       │  ║  Plugin code: self.api.get_user(id)   ║   │
       │  ╚═══════════════════════════════════════╝   │
       │                                              │
       ├──────────────────────────────────────────────►
       │           gRPC: GetUser                      │
       │           (user_id)                          │
       │                                              │
       │                                     ┌────────┤
       │                                     │ API    │
       │                                     │ Server │
       │                                     │ impl   │
       │                                     └────────┤
       │                                              │
       ◄──────────────────────────────────────────────┤
       │           Response                           │
       │           (user proto, error)                │
       │                                              │
```

### ServeHTTP Bidirectional Streaming

```
   Go Server                                     Python Plugin
       │                                              │
       │  ╔═══════════════════════════════════════╗   │
       │  ║  HTTP Request to /plugins/{id}/...    ║   │
       │  ╚═══════════════════════════════════════╝   │
       │                                              │
       │   ════════ Bidirectional Stream ════════     │
       │                                              │
       ├───────────────────────────────────────────────►
       │  Request Init (method, URL, headers)         │
       │  + first body chunk                          │
       │                                              │
       ├───────────────────────────────────────────────►
       │  Body chunk 2 (64KB)                         │
       │                                              │
       ├───────────────────────────────────────────────►
       │  Body chunk 3 + body_complete=true           │
       │                                              │
       │                                     ┌────────┤
       │                                     │ @hook  │
       │                                     │ServeHTTP│
       │                                     └────────┤
       │                                              │
       ◄───────────────────────────────────────────────┤
       │  Response Init (status=200, headers)         │
       │  + first response chunk                      │
       │                                              │
       ◄───────────────────────────────────────────────┤
       │  Response body chunk + body_complete=true    │
       │                                              │
```

## Key Design Decisions

### Response-Embedded AppError (Not gRPC Status)

**Decision**: API errors are encoded in the response message's `error` field, not as gRPC status codes.

**Rationale**:
- Preserves full AppError semantics (id, where, detailed_error, status_code, params)
- gRPC status codes are reserved for transport-level failures only
- Matches existing Go plugin error handling patterns

**Example**:
```protobuf
message GetUserResponse {
    AppError error = 1;  // Application-level error
    User user = 2;       // Success response
}
```

### 64KB Streaming Chunks

**Decision**: HTTP request/response bodies are streamed in 64KB chunks.

**Rationale**:
- Matches gRPC best practices for streaming
- Avoids buffering entire request bodies in memory
- Enables early response (plugin can respond before request fully received)

**Constant**: `serveHTTPChunkSize = 64 * 1024`

### JSON Blobs for Complex Types

**Decision**: Some complex types (Config, License, Manifest) are serialized as JSON blobs.

**Rationale**:
- These types have deeply nested structures that would be verbose in proto
- Reduces proto definition maintenance burden
- Types are used infrequently, so serialization overhead is acceptable

**Example**:
```protobuf
message ConfigJson {
    bytes config_json = 1;  // JSON-serialized model.Config
}
```

### APIServerRegistrar Pattern

**Decision**: Use a function type to break import cycle between plugin and pluginapi/grpc/server.

**Rationale**:
- `plugin` package cannot import `pluginapi/grpc/server` (circular dependency)
- The registrar function is passed in at runtime
- Pattern: `type APIServerRegistrar func(grpcServer *grpc.Server, apiImpl API)`

**Usage** (in app layer):
```go
env.SetAPIServerRegistrar(func(s *grpc.Server, api plugin.API) {
    server.Register(s, api)
})
```

### Venv-First Interpreter Discovery

**Decision**: Look for Python in plugin's venv before system PATH.

**Rationale**:
- Plugins can bundle their dependencies in a venv
- Avoids conflicts with system Python or other plugins
- Search order: `venv/bin/python` → `.venv/bin/python` → `python3` → `python`

### go-plugin Protocol

**Decision**: Use HashiCorp's go-plugin library for process management.

**Rationale**:
- Battle-tested subprocess management
- Health checking via grpc.health.v1
- Secure handshake protocol
- Automatic connection management

**Handshake Format**: `CORE-VERSION|APP-VERSION|NETWORK|ADDRESS|PROTOCOL`
- Example: `1|1|tcp|127.0.0.1:54321|grpc`

## File Reference

### Go Server Components

| Functionality | File Path |
|--------------|-----------|
| Plugin environment | `server/public/plugin/environment.go` |
| Python supervisor | `server/public/plugin/python_supervisor.go` |
| Hooks gRPC client | `server/public/plugin/hooks_grpc_client.go` |
| Hook ID constants | `server/public/plugin/hooks.go` |
| Supervisor base | `server/public/plugin/supervisor.go` |
| API Server | `server/public/pluginapi/grpc/server/api_server.go` |
| ServeHTTP handler | `server/public/pluginapi/grpc/server/serve_http.go` |

### Go API Implementation Files

| Functionality | File Path |
|--------------|-----------|
| User/Team APIs | `server/public/pluginapi/grpc/server/api_user_team.go` |
| Channel/Post APIs | `server/public/pluginapi/grpc/server/api_channel_post.go` |
| KV/Config APIs | `server/public/pluginapi/grpc/server/api_kv_config.go` |
| File/Bot APIs | `server/public/pluginapi/grpc/server/api_file_bot.go` |
| Remaining APIs | `server/public/pluginapi/grpc/server/api_remaining.go` |

### Proto Definitions

| Functionality | File Path |
|--------------|-----------|
| Main API service | `server/public/pluginapi/grpc/proto/api.proto` |
| Main hooks service | `server/public/pluginapi/grpc/proto/hooks.proto` |
| Shared types | `server/public/pluginapi/grpc/proto/types.proto` |
| User/Team messages | `server/public/pluginapi/grpc/proto/api_user_team.proto` |
| Channel/Post messages | `server/public/pluginapi/grpc/proto/api_channel_post.proto` |
| KV/Config messages | `server/public/pluginapi/grpc/proto/api_kv_config.proto` |
| File/Bot messages | `server/public/pluginapi/grpc/proto/api_file_bot.proto` |
| Remaining messages | `server/public/pluginapi/grpc/proto/api_remaining.proto` |
| Lifecycle hooks | `server/public/pluginapi/grpc/proto/hooks_lifecycle.proto` |
| Message hooks | `server/public/pluginapi/grpc/proto/hooks_message.proto` |
| User/Channel hooks | `server/public/pluginapi/grpc/proto/hooks_user_channel.proto` |
| Command hooks | `server/public/pluginapi/grpc/proto/hooks_command.proto` |
| HTTP hooks | `server/public/pluginapi/grpc/proto/hooks_http.proto` |

### Python SDK Components

| Functionality | File Path |
|--------------|-----------|
| Plugin base class | `python-sdk/src/mattermost_plugin/plugin.py` |
| Hook decorator | `python-sdk/src/mattermost_plugin/hooks.py` |
| API client | `python-sdk/src/mattermost_plugin/client.py` |
| gRPC server | `python-sdk/src/mattermost_plugin/server.py` |
| Runtime config | `python-sdk/src/mattermost_plugin/runtime_config.py` |
| Hook servicer | `python-sdk/src/mattermost_plugin/servicers/hooks_servicer.py` |
| Channel utilities | `python-sdk/src/mattermost_plugin/_internal/channel.py` |
| API mixins | `python-sdk/src/mattermost_plugin/_internal/mixins/*.py` |
| Exception types | `python-sdk/src/mattermost_plugin/exceptions.py` |

### Generated Code

| Language | Path |
|----------|------|
| Go | `server/public/pluginapi/grpc/generated/go/pluginapiv1/` |
| Python | `python-sdk/src/mattermost_plugin/grpc/` |

## Extending the System

### Adding a New API Method

1. Add RPC to appropriate `.proto` file
2. Run `make generate-grpc` to regenerate code
3. Implement method in Go API server (`server/api_*.go`)
4. Implement method in Python client mixin (`_internal/mixins/*.py`)
5. Add tests for both Go and Python implementations

### Adding a New Hook

1. Add RPC to `hooks.proto`
2. Add message types to appropriate `hooks_*.proto`
3. Run `make generate-grpc` to regenerate code
4. Implement dispatch in `hooks_grpc_client.go`
5. Add to `HookName` enum in Python (`hooks.py`)
6. Handle in `PluginHooksServicerImpl` (`servicers/hooks_servicer.py`)
7. Add tests

### Adding a New Model Type

1. Add message definition to `types.proto`
2. Add conversion functions in Go (`hooks_grpc_client.go` or `server/api_*.go`)
3. Add Python dataclass in `python-sdk/src/mattermost_plugin/models/`
4. Add proto-to-model conversion in Python

---

*This architecture documentation is intended for internal Mattermost engineers working on the Python plugin infrastructure.*
