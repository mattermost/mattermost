# Technical Feasibility Report: gRPC Support for Non-Go Plugins

## Executive Summary

This report analyzes the feasibility of enabling non-Go plugins (specifically Python) in Mattermost via gRPC while maintaining the current managed subprocess model. The analysis reveals that while the hashicorp/go-plugin library theoretically supports gRPC, Mattermost's current implementation exclusively uses net/rpc with gob encoding. Enabling gRPC support requires significant but achievable changes across protocol negotiation, interface definitions, and the plugin launcher.

**Overall Assessment**: **FEASIBLE with Moderate-High Effort**

---

## 1. Protocol Negotiation Analysis

### 1.1 Files Controlling Protocol Negotiation

| File | Purpose |
|------|---------|
| `server/public/plugin/api.go` | Contains `HandshakeConfig` definition (lines 1569-1573) |
| `server/public/plugin/supervisor.go` | Contains `plugin.ClientConfig` instantiation (lines 117-124) |
| `server/public/plugin/client.go` | Contains `plugin.ServeConfig` for plugin-side (lines 76-88) |
| `server/public/plugin/client_rpc.go` | Implements `hooksPlugin` with net/rpc-only `Server()` and `Client()` methods |

### 1.2 Current Configuration

The handshake configuration is defined in `server/public/plugin/api.go`:

```go
var handshake = plugin.HandshakeConfig{
    ProtocolVersion:  1,
    MagicCookieKey:   "MATTERMOST_PLUGIN",
    MagicCookieValue: "Securely message teams, anywhere.",
}
```

**Critical Finding**: The `AllowedProtocols` field is **NOT SET**, which means only net/rpc is allowed by default. From the go-plugin documentation:

> "If this isn't set at all (nil value), then only net/rpc is accepted. This is done for legacy reasons. You must explicitly opt-in to new protocols."

### 1.3 Required Changes for gRPC Support

1. **Server-Side (supervisor.go)**: Add `AllowedProtocols` to `ClientConfig`:
   ```go
   clientConfig := &plugin.ClientConfig{
       HandshakeConfig:  handshake,
       Plugins:          pluginMap,
       AllowedProtocols: []plugin.Protocol{plugin.ProtocolNetRPC, plugin.ProtocolGRPC},
       // ... existing config
   }
   ```

2. **Plugin-Side (client.go)**: Add gRPC server configuration:
   ```go
   serveConfig := &plugin.ServeConfig{
       HandshakeConfig: handshake,
       Plugins:         pluginMap,
       GRPCServer:      plugin.DefaultGRPCServer, // Enable gRPC
   }
   ```

3. **hooksPlugin Implementation**: The `hooksPlugin` struct must implement `plugin.GRPCPlugin` interface in addition to the current `plugin.Plugin` interface.

---

## 2. RPC Interface Audit for Protobuf Conversion

### 2.1 Hooks Interface (Server → Plugin)

The Hooks interface in `server/public/plugin/hooks.go` contains **48 hook methods**. Key hooks requiring Protobuf definitions:

| Hook | Complex Types | Difficulty |
|------|---------------|------------|
| `ServeHTTP` | `http.ResponseWriter`, `*http.Request` | **BLOCKER** |
| `ServeMetrics` | `http.ResponseWriter`, `*http.Request` | **BLOCKER** |
| `FileWillBeUploaded` | `io.Reader`, `io.Writer` | High |
| `MessageWillBePosted` | `*model.Post` | Medium |
| `ExecuteCommand` | `*model.CommandArgs`, `*model.CommandResponse` | Medium |
| `OnSharedChannelsSyncMsg` | `*model.SyncMsg`, `*model.RemoteCluster` | Medium |
| All other hooks | Various model types | Medium |

### 2.2 API Interface (Plugin → Server)

The API interface in `server/public/plugin/api.go` contains **~150+ methods**. Categories:

| Category | Method Count | Example Methods |
|----------|--------------|-----------------|
| User Management | ~25 | `CreateUser`, `GetUser`, `UpdateUser` |
| Channel Operations | ~20 | `CreateChannel`, `GetChannel`, `AddChannelMember` |
| Post Operations | ~15 | `CreatePost`, `UpdatePost`, `DeletePost` |
| Team Operations | ~15 | `CreateTeam`, `GetTeam`, `CreateTeamMember` |
| KV Store | ~8 | `KVSet`, `KVGet`, `KVDelete`, `KVList` |
| File Operations | ~10 | `UploadFile`, `GetFile`, `GetFileInfo` |
| Plugin Operations | ~8 | `InstallPlugin`, `EnablePlugin`, `GetPlugins` |
| Logging | 4 | `LogDebug`, `LogInfo`, `LogWarn`, `LogError` |
| Other | ~45 | Various utility methods |

### 2.3 Complex Go Structs Requiring Protobuf Definitions

**High-Priority Model Types** (frequently used across interfaces):

| Model Type | Fields | Location |
|------------|--------|----------|
| `model.Post` | 20+ fields including nested `*PostMetadata`, `[]*User` | `server/public/model/post.go` |
| `model.User` | 35+ fields including `StringMap`, `StringArray` | `server/public/model/user.go` |
| `model.Channel` | 15+ fields including `ChannelBannerInfo` | `server/public/model/channel.go` |
| `model.Team` | 15+ fields | `server/public/model/team.go` |
| `model.Config` | Massive nested configuration | `server/public/model/config.go` |
| `model.AppError` | Error wrapper with HTTP status codes | `server/public/model/apperror.go` |
| `model.CommandArgs` | Command execution context | `server/public/model/command_args.go` |
| `model.FileInfo` | File metadata with 20+ fields | `server/public/model/file_info.go` |
| `model.Reaction` | Reaction data | `server/public/model/reaction.go` |
| `model.ChannelMember` | Membership with notification props | `server/public/model/channel_member.go` |
| `model.TeamMember` | Team membership | `server/public/model/team.go` |
| `model.Session` | Session data | `server/public/model/session.go` |
| `model.Status` | User status | `server/public/model/status.go` |
| `model.Bot` | Bot configuration | `server/public/model/bot.go` |
| `model.Command` | Slash command definition | `server/public/model/command.go` |
| `model.Manifest` | Plugin manifest | `server/public/model/manifest.go` |
| `plugin.Context` | Request context | `server/public/plugin/context.go` |

**Support Types**:
- `model.StringMap` (alias for `map[string]string`)
- `model.StringArray` (alias for `[]string`)
- `model.StringInterface` (alias for `map[string]interface{}`)
- `driver.NamedValue` (for DB operations)
- `driver.TxOptions` (for transactions)
- `model.SyncMsg` (shared channels)
- `model.PluginClusterEvent` (HA clustering)

**Estimated Protobuf Definition Effort**: ~50-70 `.proto` files with mapper functions.

### 2.4 Types Registered with gob

Current gob registrations in `client_rpc.go`:

```go
gob.Register([]*model.SlackAttachment{})
gob.Register([]any{})
gob.Register(map[string]any{})
gob.Register(&model.AppError{})
gob.Register(&pq.Error{})
gob.Register(&ErrorString{})
gob.Register(&model.AutocompleteDynamicListArg{})
gob.Register(&model.AutocompleteStaticListArg{})
gob.Register(&model.AutocompleteTextArg{})
gob.Register(&model.PreviewPost{})
gob.Register(model.PropertyOptions[*model.PluginPropertyOption]{})
```

These types and all model types used in interfaces need Protobuf equivalents.

---

## 3. Plugin Process Launcher Analysis

### 3.1 Current Implementation

The plugin launcher in `server/public/plugin/supervisor.go` (function `WithExecutableFromManifest`):

```go
func WithExecutableFromManifest(pluginInfo *model.BundleInfo) func(*supervisor, *plugin.ClientConfig) error {
    return func(_ *supervisor, clientConfig *plugin.ClientConfig) error {
        executable := pluginInfo.Manifest.GetExecutableForRuntime(runtime.GOOS, runtime.GOARCH)
        // ... validation ...
        cmd := exec.Command(executable)
        clientConfig.Cmd = cmd
        clientConfig.SecureConfig = &plugin.SecureConfig{
            Checksum: pluginChecksum,
            Hash:     sha256.New(),
        }
        return nil
    }
}
```

### 3.2 Current Manifest Schema (server/public/model/manifest.go)

```go
type ManifestServer struct {
    Executables map[string]string `json:"executables,omitempty" yaml:"executables,omitempty"`
    Executable  string            `json:"executable" yaml:"executable"`
}
```

### 3.3 Proposed Manifest Extension

Extend `ManifestServer` to support interpreted languages:

```go
type ManifestServer struct {
    // Existing fields
    Executables map[string]string `json:"executables,omitempty" yaml:"executables,omitempty"`
    Executable  string            `json:"executable" yaml:"executable"`
    
    // New fields for non-Go plugins
    Runtime     string   `json:"runtime,omitempty" yaml:"runtime,omitempty"`      // e.g., "python3", "node"
    Entrypoint  string   `json:"entrypoint,omitempty" yaml:"entrypoint,omitempty"` // e.g., "main.py"
    RuntimeArgs []string `json:"runtime_args,omitempty" yaml:"runtime_args,omitempty"` // e.g., ["-u"]
}
```

Example plugin.json for Python:

```json
{
  "id": "com.example.python-plugin",
  "name": "Python Plugin",
  "version": "1.0.0",
  "server": {
    "runtime": "python3",
    "entrypoint": "server/main.py",
    "runtime_args": ["-u"]
  }
}
```

### 3.4 Modified Launcher Logic

```go
func WithExecutableFromManifest(pluginInfo *model.BundleInfo) func(*supervisor, *plugin.ClientConfig) error {
    return func(_ *supervisor, clientConfig *plugin.ClientConfig) error {
        server := pluginInfo.Manifest.Server
        
        var cmd *exec.Cmd
        if server.Runtime != "" {
            // Interpreted language plugin
            entrypoint := filepath.Join(pluginInfo.Path, server.Entrypoint)
            args := append(server.RuntimeArgs, entrypoint)
            cmd = exec.Command(server.Runtime, args...)
            // Note: SecureConfig checksum verification not applicable for scripts
        } else {
            // Compiled Go plugin (existing logic)
            executable := pluginInfo.Manifest.GetExecutableForRuntime(runtime.GOOS, runtime.GOARCH)
            // ... existing implementation ...
        }
        
        clientConfig.Cmd = cmd
        return nil
    }
}
```

---

## 4. Data Marshaling Constraints & Blockers

### 4.1 Critical Blockers

#### HTTP Interface Handling (`ServeHTTP`, `ServeMetrics`)

**Current Implementation**: Uses complex `MuxBroker` stream multiplexing to proxy `http.ResponseWriter` and `http.Request` over RPC (see `client_rpc.go` lines 389-489).

**Problem**: This pattern is deeply tied to Go's RPC model and cannot be directly replicated in gRPC:
- Creates secondary RPC connections for response streaming
- Uses `net.Conn` and `bufio.ReadWriter` for hijacking
- Implements custom IO streaming protocol (`io_rpc.go`)

**Potential Solutions**:
1. **HTTP Proxy Pattern**: Route HTTP requests through a local HTTP server in the plugin subprocess rather than serializing the handler interface
2. **gRPC Bidirectional Streaming**: Use gRPC bidirectional streams for request/response bodies
3. **Limit to non-HTTP plugins initially**: Defer HTTP handler support to a later phase

#### io.Reader/io.Writer Streaming

**Current Implementation**: Custom streaming protocol in `io_rpc.go`:
```go
func serveIOReader(r io.Reader, conn io.ReadWriteCloser) {
    // Custom protocol: reads size via varint, then streams bytes
}
```

**Problem**: Used by `FileWillBeUploaded` hook and file operations.

**Solution**: Replace with gRPC streaming RPCs.

### 4.2 Go-Specific Serialization Challenges

| Pattern | Current Usage | gRPC Solution |
|---------|---------------|---------------|
| `interface{}` / `any` | Logging methods, Config maps | Use `google.protobuf.Any` or `google.protobuf.Struct` |
| `map[string]interface{}` | Plugin config, Props | Use `google.protobuf.Struct` |
| `sync.RWMutex` in structs | `model.Post.propsMu` | Exclude from serialization (transient) |
| Custom error types | `model.AppError`, `pq.Error` | Define error message proto with fields |
| Slice of pointers | `[]*model.User` | Use `repeated User` in proto |
| Nullable strings | `*string` fields | Use `google.protobuf.StringValue` |

### 4.3 Database Driver Interface

**Current Implementation**: `Driver` interface in `driver.go` exposes raw database operations:
- Connection management (`Conn`, `ConnClose`, `ConnPing`)
- Query execution (`ConnQuery`, `ConnExec`)
- Transaction handling (`Tx`, `TxCommit`, `TxRollback`)
- Result set iteration (`RowsNext`, `RowsColumns`)

**Challenge**: `driver.Value` and `driver.NamedValue` are Go-specific types.

**Solution**: For non-Go plugins, consider:
1. JSON serialization of query results
2. Higher-level query API hiding driver details
3. Limiting DB access to read-only operations initially

---

## 5. Implementation Strategy

### Phase 1: Core gRPC Infrastructure (4-6 weeks)

1. Add `AllowedProtocols` to server and plugin configurations
2. Create gRPC plugin interface alongside existing net/rpc
3. Define initial Protobuf messages for core model types:
   - `Post`, `User`, `Channel`, `Team`
   - `AppError`, `Context`
   - Basic request/response wrappers

### Phase 2: Hook Implementation (6-8 weeks)

1. Implement gRPC versions of lifecycle hooks:
   - `OnActivate`, `OnDeactivate`, `OnConfigurationChange`
2. Implement notification hooks:
   - `MessageWillBePosted`, `MessageHasBeenPosted`
   - `UserHasBeenCreated`, etc.
3. Defer HTTP-related hooks (`ServeHTTP`, `ServeMetrics`)

### Phase 3: API Implementation (8-10 weeks)

1. Implement high-priority API methods:
   - KV Store operations
   - User/Channel/Team read operations
   - Post creation
   - Logging
2. Generate Go<->Proto mapper functions
3. Create Python SDK with gRPC stubs

### Phase 4: Advanced Features (4-6 weeks)

1. Implement streaming for file operations
2. Add HTTP handler support via proxy pattern
3. Database driver support (if needed)

### Phase 5: Testing & Documentation (2-4 weeks)

1. Create Python plugin examples
2. Update plugin SDK documentation
3. Performance testing and optimization

---

## 6. Potential Blockers Summary

| Blocker | Severity | Mitigation |
|---------|----------|------------|
| `http.ResponseWriter` serialization | **HIGH** | Use HTTP proxy pattern or defer |
| `io.Reader`/`io.Writer` streaming | MEDIUM | Use gRPC streaming |
| `interface{}`/`any` types | MEDIUM | Use `protobuf.Any` or `Struct` |
| Database driver types | LOW | Provide high-level wrapper |
| Checksum verification for scripts | LOW | Use alternative verification method |
| Generated RPC code volume | LOW | Automate proto generation |

---

## 7. Recommendations

1. **Start with a limited API surface**: Begin with non-HTTP hooks and read-only API methods
2. **Automate proto generation**: Create tooling to generate `.proto` files from Go interfaces
3. **Parallel development**: Maintain net/rpc support while adding gRPC
4. **Python SDK first**: Focus on Python as the initial non-Go language
5. **Community engagement**: Share design documents for feedback before implementation

---

## 8. File Reference Summary

### Protocol Negotiation Files
- `server/public/plugin/api.go` - HandshakeConfig
- `server/public/plugin/supervisor.go` - ClientConfig, process launch
- `server/public/plugin/client.go` - ServeConfig (plugin side)
- `server/public/plugin/client_rpc.go` - hooksPlugin, RPC implementation

### Interface Definition Files  
- `server/public/plugin/hooks.go` - Hooks interface (48 methods)
- `server/public/plugin/api.go` - API interface (~150 methods)
- `server/public/plugin/driver.go` - Database driver interface

### RPC Implementation Files
- `server/public/plugin/client_rpc.go` - Manual RPC handlers
- `server/public/plugin/client_rpc_generated.go` - Generated RPC handlers
- `server/public/plugin/db_rpc.go` - Database RPC
- `server/public/plugin/http.go` - HTTP response writer RPC
- `server/public/plugin/hijack.go` - HTTP hijacking support
- `server/public/plugin/io_rpc.go` - IO streaming

### Model Files (require Protobuf definitions)
- `server/public/model/post.go`
- `server/public/model/user.go`
- `server/public/model/channel.go`
- `server/public/model/team.go`
- `server/public/model/config.go`
- `server/public/model/manifest.go`
- (and ~50+ more model files)

---

*Report generated: January 13, 2026*
*Analysis based on: mattermost/mattermost repository*
