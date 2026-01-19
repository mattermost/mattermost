# Phase 11: Server Integration - Research

**Researched:** 2026-01-19
**Domain:** Mattermost server plugin infrastructure integration
**Confidence:** HIGH

<research_summary>
## Summary

Researched how to wire Python plugin support into the main Mattermost server plugin loading path. The infrastructure from Phases 1-10 has built all the pieces:
- gRPC protobuf definitions for hooks and API (Phases 1-4)
- Go gRPC server wrapping the Plugin API (Phase 4)
- Python supervisor for process management (Phase 5)
- Python SDK with hook servicer (Phases 6-7)
- HTTP streaming over gRPC (Phase 8)
- Manifest extension (Phase 9)
- Example plugin and integration tests (Phase 10)

The key finding is that Phase 5's supervisor currently has a hardcoded limitation that skips hook dispensing for Python plugins (`supervisor.go:153-161`). Phase 11 must remove this limitation and implement a gRPC-based hook adapter that conforms to the existing `plugin.Hooks` interface.

**Primary recommendation:** Implement `hooksGRPCClient` adapter that wraps a gRPC client to the Python plugin's PluginHooks service, conforming to the existing `Hooks` interface. This enables Python plugins to slot into the existing hook dispatch infrastructure (RunMultiPluginHook, HooksForPlugin) without modifications.

</research_summary>

<standard_stack>
## Standard Stack

### Core (Already Implemented)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| hashicorp/go-plugin | v1.6+ | Plugin process management | Already in use, handles gRPC transport |
| google.golang.org/grpc | v1.60+ | gRPC client/server | Already in use for Python plugins |
| grpc-health-v1 | built-in | Health checking | Standard go-plugin health protocol |

### Supporting (Already Implemented)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| grpcio | 1.60+ | Python gRPC | Python plugin side (Phase 6) |
| grpcio-health-checking | 1.60+ | Python health service | Plugin health (Phase 7) |

### Key Interfaces to Implement
| Interface | Location | Purpose | Implementation |
|-----------|----------|---------|----------------|
| `plugin.Hooks` | `server/public/plugin/hooks.go` | Hook dispatch interface | `hooksGRPCClient` adapter |
| `PluginHooksClient` | Generated from hooks.proto | gRPC client stub | Already generated |

**No new dependencies required - this phase wires together existing infrastructure.**

</standard_stack>

<architecture_patterns>
## Architecture Patterns

### Current Architecture (Phase 5 Limitation)

```
supervisor.go (newSupervisor)
├── Check isPythonPlugin()
├── Set gRPC protocol & extended timeout
├── Create go-plugin client
├── Get rpcClient
└── IF Python:
    └── SKIP hook dispensing <-- PHASE 5 LIMITATION
        "Python plugin started (hooks not yet available)"
        return early with sup.hooks = nil
```

The early return at line 159 means:
- `sup.hooks` is nil for Python plugins
- `HooksForPlugin()` returns nil hooks
- `RunMultiPluginHook()` skips Python plugins (supervisor.Implements returns false)
- No HTTP routing to Python plugins

### Target Architecture (Phase 11)

```
supervisor.go (newSupervisor)
├── Check isPythonPlugin()
├── Set gRPC protocol & extended timeout
├── Create go-plugin client
├── Get rpcClient (gRPC connection)
└── IF Python:
    ├── Create gRPC PluginHooksClient from connection
    ├── Create hooksGRPCClient adapter wrapping PluginHooksClient
    ├── Call Implemented() to discover hooks
    └── Set sup.hooks = hooksGRPCClient adapter
```

### Recommended Project Structure

```
server/public/plugin/
├── hooks.go                    # Hooks interface (unchanged)
├── supervisor.go               # Remove Python limitation
├── python_supervisor.go        # Python detection (unchanged)
├── hooks_grpc_client.go        # NEW: hooksGRPCClient adapter
└── hooks_grpc_client_test.go   # NEW: adapter tests
```

### Pattern 1: Hook Adapter (hooksGRPCClient)

**What:** Adapter implementing `plugin.Hooks` that delegates to gRPC client
**When to use:** For Python plugins only
**Example:**

```go
// hooks_grpc_client.go

// hooksGRPCClient adapts a gRPC PluginHooksClient to the Hooks interface.
// This allows Python plugins to be used identically to Go plugins in the
// hook dispatch infrastructure.
type hooksGRPCClient struct {
    client      pb.PluginHooksClient
    implemented [TotalHooksID]bool
    log         *mlog.Logger
}

func newHooksGRPCClient(conn *grpc.ClientConn, log *mlog.Logger) (*hooksGRPCClient, error) {
    client := pb.NewPluginHooksClient(conn)
    h := &hooksGRPCClient{
        client: client,
        log:    log,
    }

    // Query which hooks the plugin implements
    resp, err := client.Implemented(context.Background(), &pb.ImplementedRequest{})
    if err != nil {
        return nil, err
    }

    for _, hookName := range resp.HookNames {
        if hookId, ok := hookNameToId[hookName]; ok {
            h.implemented[hookId] = true
        }
    }

    return h, nil
}

func (h *hooksGRPCClient) Implemented() ([]string, error) {
    resp, err := h.client.Implemented(context.Background(), &pb.ImplementedRequest{})
    if err != nil {
        return nil, err
    }
    return resp.HookNames, nil
}

func (h *hooksGRPCClient) OnActivate() error {
    resp, err := h.client.OnActivate(context.Background(), &pb.OnActivateRequest{})
    if err != nil {
        return fmt.Errorf("gRPC OnActivate failed: %w", err)
    }
    if resp.Error != nil {
        return model.AppErrorFromProto(resp.Error)
    }
    return nil
}

// ... implement remaining Hooks interface methods
```

### Pattern 2: ServeHTTP Streaming Handler

**What:** Special handling for ServeHTTP which uses bidirectional streaming
**When to use:** HTTP requests to Python plugins via `/plugins/{id}/**`
**Example:**

```go
func (h *hooksGRPCClient) ServeHTTP(c *Context, w http.ResponseWriter, r *http.Request) {
    // Open bidirectional stream
    stream, err := h.client.ServeHTTP(r.Context())
    if err != nil {
        http.Error(w, "Plugin unavailable", http.StatusServiceUnavailable)
        return
    }
    defer stream.CloseSend()

    // Send request (init + body chunks)
    if err := sendHTTPRequest(stream, c, r); err != nil {
        http.Error(w, "Request failed", http.StatusBadGateway)
        return
    }

    // Receive response (init + body chunks)
    if err := receiveHTTPResponse(stream, w); err != nil {
        // Response may have started, can't write error
        h.log.Error("Error receiving response", mlog.Err(err))
        return
    }
}
```

### Pattern 3: Go-Plugin gRPC Client Connection

**What:** Extract gRPC connection from go-plugin's rpcClient
**When to use:** To create PluginHooksClient
**Example:**

```go
// In supervisor.go newSupervisor(), after rpcClient connection

if isPython {
    // go-plugin with gRPC protocol provides a *grpc.ClientConn
    conn := rpcClient.(*plugin.GRPCClient).Conn

    hooksClient, err := newHooksGRPCClient(conn, wrappedLogger)
    if err != nil {
        return nil, errors.Wrap(err, "failed to create hooks client")
    }

    sup.hooks = &hooksTimerLayer{pluginInfo.Manifest.Id, hooksClient, metrics}

    // Populate implemented array for fast hook dispatch
    for _, hookName := range hooksClient.implementedHooks() {
        if hookId, ok := hookNameToId[hookName]; ok {
            sup.implemented[hookId] = true
        }
    }

    return &sup, nil
}
```

### Anti-Patterns to Avoid

- **Duplicating RPC client logic:** Don't create a parallel hook dispatch system. Reuse existing `RunMultiPluginHook` and `HooksForPlugin`.
- **Blocking on gRPC calls:** Use appropriate timeouts and context cancellation.
- **Ignoring error conversion:** Always convert gRPC errors to model.AppError where appropriate.
- **Not handling streaming properly:** ServeHTTP uses bidirectional streaming; don't buffer entire body.

</architecture_patterns>

<dont_hand_roll>
## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Hook dispatch | Custom Python dispatch loop | Existing RunMultiPluginHook | Already handles iteration, metrics, error handling |
| HTTP routing | Custom route registration | Existing ServePluginRequest | Already handles auth, CSRF, subpath stripping |
| Process supervision | Custom process management | hashicorp/go-plugin | Already handles start, health, restart |
| gRPC connection | Manual socket handling | go-plugin GRPCClient.Conn | Handles TLS, reconnection, multiplexing |
| Health checking | Custom ping loop | grpc-health-v1 | Standard protocol, already used |

**Key insight:** Phase 11 is about integration, not new infrastructure. The hook adapter pattern allows Python plugins to use all existing plugin infrastructure unchanged.

</dont_hand_roll>

<common_pitfalls>
## Common Pitfalls

### Pitfall 1: Blocking Hooks Without Timeout
**What goes wrong:** OnActivate or other hooks hang forever
**Why it happens:** gRPC calls without context deadline
**How to avoid:** Use context.WithTimeout for all hook invocations (match existing hook timeout patterns)
**Warning signs:** Plugin appears to hang during activation

### Pitfall 2: gRPC Client Type Assertion Failure
**What goes wrong:** Panic or error getting gRPC connection
**Why it happens:** go-plugin returns different client types for different protocols
**How to avoid:** Check `isPythonPlugin()` before type assertion; Python plugins use `*plugin.GRPCClient`, Go plugins use net/rpc
**Warning signs:** Type assertion panic in newSupervisor

### Pitfall 3: Missing Hook ID in hookNameToId Map
**What goes wrong:** Plugin claims to implement a hook but it's never called
**Why it happens:** Hook name string doesn't match the hookNameToId map keys
**How to avoid:** Use consistent hook names between proto and Go (both defined in hooks.go)
**Warning signs:** Implemented() returns hooks but RunMultiPluginHook skips them

### Pitfall 4: ServeHTTP Stream Errors After Response Started
**What goes wrong:** Can't report error to client after headers sent
**Why it happens:** HTTP response already started when gRPC stream error occurs
**How to avoid:** Handle errors gracefully, log but don't try to write error response
**Warning signs:** "http: superfluous response.WriteHeader" errors

### Pitfall 5: Not Closing gRPC Streams
**What goes wrong:** Resource leak, eventually connection exhaustion
**Why it happens:** Forgetting to call CloseSend() or not handling stream cleanup
**How to avoid:** Use defer for stream cleanup; check context cancellation
**Warning signs:** Increasing memory usage, "too many open files" errors

### Pitfall 6: API Server Registration Missing
**What goes wrong:** Python plugins can start but API calls fail
**Why it happens:** API gRPC server not registered with the same connection
**How to avoid:** The API server is already set up via go-plugin broker; ensure Python SDK connects to the API server address passed via environment variable (MATTERMOST_API_TARGET)
**Warning signs:** "Unimplemented" errors from Python plugin API calls

</common_pitfalls>

<code_examples>
## Code Examples

Verified patterns from existing codebase:

### Getting gRPC Connection from go-plugin
```go
// Source: hashicorp/go-plugin documentation + codebase inspection
// The rpcClient from sup.client.Client() is protocol-specific.
// For gRPC protocol, it's a *plugin.GRPCClient with a Conn field.

rpcClient, err := sup.client.Client()
if err != nil {
    return nil, err
}

// For Python plugins (gRPC protocol), extract the connection:
if isPython {
    grpcClient, ok := rpcClient.(*plugin.GRPCClient)
    if !ok {
        return nil, errors.New("expected gRPC client for Python plugin")
    }
    conn := grpcClient.Conn
    // Use conn to create PluginHooksClient
}
```

### Existing Hook Dispatch Pattern
```go
// Source: server/public/plugin/environment.go:618
// This is the pattern Python plugins will slot into

func (env *Environment) RunMultiPluginHook(hookRunnerFunc func(hooks Hooks, manifest *model.Manifest) bool, hookId int) {
    env.registeredPlugins.Range(func(key, value any) bool {
        rp := value.(registeredPlugin)

        // This check uses supervisor.Implements() which checks the implemented array
        if rp.supervisor == nil || !rp.supervisor.Implements(hookId) || !env.IsActive(rp.BundleInfo.Manifest.Id) {
            return true
        }

        // This calls supervisor.Hooks() which returns the hooks adapter
        result := hookRunnerFunc(rp.supervisor.Hooks(), rp.BundleInfo.Manifest)
        return result
    })
}
```

### ServeHTTP Streaming Flow
```go
// Source: server/public/pluginapi/grpc/server/serve_http.go + hooks_http.proto

// Request flow (Go -> Python):
// 1. Send init message with method, URL, headers
// 2. Stream body chunks (64KB each)
// 3. Send body_complete=true on last chunk

// Response flow (Python -> Go):
// 1. Receive init message with status, headers
// 2. Receive body chunks
// 3. body_complete=true indicates end

const defaultChunkSize = 64 * 1024 // 64KB
```

### Converting Errors
```go
// Source: server/public/pluginapi/grpc/server/errors.go

// For hook responses that include AppError:
if resp.Error != nil {
    return &model.AppError{
        Id:            resp.Error.Id,
        Message:       resp.Error.Message,
        DetailedError: resp.Error.DetailedError,
        StatusCode:    int(resp.Error.StatusCode),
        Where:         resp.Error.Where,
    }
}
```

</code_examples>

<sota_updates>
## State of the Art (2025-2026)

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Go plugins only | Go + Python plugins | This project | Enables Python plugin ecosystem |
| net/rpc only | net/rpc (Go) + gRPC (Python) | Phase 1 | gRPC provides streaming, better typing |
| Buffered HTTP bodies | Streaming HTTP bodies | Phase 8 | Large request/response support |

**New patterns established:**
- `hooksGRPCClient` adapter pattern for language-agnostic plugin support
- Bidirectional streaming for HTTP hooks
- Manifest runtime field for plugin language detection

**No deprecated patterns** - this is new functionality building on stable infrastructure.

</sota_updates>

<open_questions>
## Open Questions

Things that couldn't be fully resolved:

1. **GetPluginID in API calls**
   - What we know: Deferred in Phase 4 (04-04-PLAN.md) because it requires supervisor context
   - What's unclear: Whether the plugin ID should be passed via gRPC metadata or response
   - Recommendation: Pass plugin ID via environment variable (already done: MATTERMOST_PLUGIN_ID)

2. **Concurrent hook invocations**
   - What we know: Multiple hooks can be invoked concurrently (e.g., MessageWillBePosted while ServeHTTP is running)
   - What's unclear: Whether Python's asyncio handles this correctly in all edge cases
   - Recommendation: Python SDK uses async servicer with proper concurrency; test under load

3. **Metrics integration**
   - What we know: hooksTimerLayer wraps hooks for metrics collection
   - What's unclear: Whether Python plugins need additional gRPC-specific metrics
   - Recommendation: Start with existing timer layer; add gRPC metrics if needed later

</open_questions>

<sources>
## Sources

### Primary (HIGH confidence)
- `server/public/plugin/supervisor.go` - Phase 5 limitation code
- `server/public/plugin/hooks.go` - Hooks interface definition
- `server/public/plugin/environment.go` - RunMultiPluginHook, HooksForPlugin
- `server/public/plugin/client_rpc.go` - hooksRPCClient pattern for Go plugins
- `server/public/pluginapi/grpc/proto/hooks.proto` - gRPC service definition
- `python-sdk/src/mattermost_plugin/servicers/hooks_servicer.py` - Python hook implementation
- `server/channels/app/plugin_requests.go` - HTTP routing to plugins

### Secondary (MEDIUM confidence)
- hashicorp/go-plugin GRPCClient documentation - verified with code inspection
- Existing test patterns in `python_supervisor_test.go`

### Tertiary (LOW confidence - needs validation)
- None - all findings verified against codebase

</sources>

<metadata>
## Metadata

**Research scope:**
- Core technology: Mattermost plugin supervisor, gRPC hook dispatch
- Ecosystem: hashicorp/go-plugin, grpc-go
- Patterns: Adapter pattern for Hooks interface, streaming HTTP
- Pitfalls: Timeout handling, stream lifecycle, error conversion

**Confidence breakdown:**
- Standard stack: HIGH - Already implemented in Phases 1-10
- Architecture: HIGH - Based on existing codebase patterns
- Pitfalls: HIGH - Identified from code inspection and existing tests
- Code examples: HIGH - From actual codebase

**Research date:** 2026-01-19
**Valid until:** Indefinite (internal architecture research, not external ecosystem)

</metadata>

---

*Phase: 11-server-integration*
*Research completed: 2026-01-19*
*Ready for planning: yes*
