# Plugin Bridge Migration Guide

## Overview

This guide helps plugin developers migrate from the **RPC-based Plugin Bridge** (using `ExecuteBridgeCall` hook) to the **HTTP-based Plugin Bridge** (using `ServeHTTP` with REST endpoints).

**Target Audience**: Plugin developers who previously implemented the `ExecuteBridgeCall` hook and need to migrate to the new HTTP-based approach.

**Reference Implementation**: See the [Agents Plugin PR #416](https://github.com/mattermost/mattermost-plugin-agents/pull/416) for a complete example of this migration.

---

## What Changed and Why

### Previous Approach (RPC-Based)
- Plugins implemented `ExecuteBridgeCall(c *Context, method string, request []byte, responseSchema []byte) ([]byte, error)`
- Method names like `"GenerateCompletion"` were used to route calls
- Source plugin ID was passed via `Context.SourcePluginId`
- Response schema was passed as a direct parameter

### New Approach (HTTP-Based)
- Plugins implement REST endpoints in their existing `ServeHTTP` hook
- REST paths like `"/api/v1/completion"` are used to route calls
- Source plugin ID is passed via `X-Mattermost-Source-Plugin-Id` HTTP header
- Response schema is passed via `X-Mattermost-Response-Schema` HTTP header (base64-encoded)

### Why This Change?
1. **Leverages existing infrastructure**: Uses proven `PluginHTTP` routing
2. **RESTful and familiar**: Standard HTTP/REST patterns
3. **Better debuggability**: Can use standard HTTP tools
4. **More flexible**: Supports full REST semantics (different HTTP methods, status codes, etc.)

---

## Migration Steps for Agents Plugin

### Step 1: Remove ExecuteBridgeCall Hook

**Before (RPC-based):**
```go
// DELETE THIS METHOD
func (p *Plugin) ExecuteBridgeCall(c *plugin.Context, method string, request []byte, responseSchema []byte) ([]byte, error) {
    // Log incoming call
    p.API.LogInfo("Bridge call received",
        "method", method,
        "source", c.SourcePluginId,
        "has_schema", responseSchema != nil,
    )

    // Route to method handlers
    switch method {
    case "GenerateCompletion":
        return p.handleGenerateCompletion(c, request, responseSchema)
    case "SummarizeChannel":
        return p.handleSummarizeChannel(c, request, responseSchema)
    default:
        return nil, fmt.Errorf("unknown method: %s", method)
    }
}
```

**Action**: Remove the entire `ExecuteBridgeCall` method from your plugin.

---

### Step 2: Add REST Endpoints to ServeHTTP

**After (HTTP-based):**
```go
func (p *Plugin) ServeHTTP(c *plugin.Context, w http.ResponseWriter, r *http.Request) {
    // Extract bridge call metadata from headers
    pluginID := r.Header.Get("Mattermost-Plugin-ID")  // "com.mattermost.server" for core, plugin ID for plugins
    userID := r.Header.Get("Mattermost-User-Id")
    requestID := r.Header.Get("X-Mattermost-Request-Id")
    responseSchemaEncoded := r.Header.Get("X-Mattermost-Response-Schema")
    
    // Decode response schema if provided (base64-encoded)
    var responseSchema []byte
    if responseSchemaEncoded != "" {
        decoded, err := base64.StdEncoding.DecodeString(responseSchemaEncoded)
        if err == nil {
            responseSchema = decoded
        }
    }
    
    // Log incoming bridge call
    if pluginID != "" || requestID != "" {
        p.API.LogInfo("Bridge call received",
            "endpoint", r.URL.Path,
            "caller", pluginID,
            "user", userID,
            "request_id", requestID,
            "has_schema", responseSchema != nil,
        )
    }

    // Route to appropriate REST endpoint
    switch r.URL.Path {
    case "/api/v1/completion":
        p.handleCompletionEndpoint(w, r, pluginID, userID, responseSchema)
        return
    
    case "/api/v1/summarize":
        p.handleSummarizeEndpoint(w, r, pluginID, userID, responseSchema)
        return
    
    // ... other endpoints for plugin's normal HTTP handlers
    
    default:
        http.Error(w, "not found", http.StatusNotFound)
    }
}
```

**Key Changes**:
- Extract metadata from HTTP headers instead of Context/parameters
- Use URL path routing instead of method name switching
- Pass `http.ResponseWriter` and `http.Request` to handlers

---

### Step 3: Convert Method Handlers to HTTP Handlers

**Before (RPC-based method handler):**
```go
func (p *Plugin) handleGenerateCompletion(c *plugin.Context, request []byte, responseSchema []byte) ([]byte, error) {
    // Parse request
    var req struct {
        Prompt  string `json:"prompt"`
        Context string `json:"context"`
    }
    if err := json.Unmarshal(request, &req); err != nil {
        return nil, fmt.Errorf("invalid request: %w", err)
    }

    // Authorization check
    if !p.isAuthorized(c.SourcePluginId, "GenerateCompletion") {
        return nil, fmt.Errorf("unauthorized")
    }

    // Call LLM
    var completion string
    var err error
    
    if responseSchema != nil {
        completion, err = p.callLLMWithSchema(req.Prompt, req.Context, responseSchema)
    } else {
        completion, err = p.callLLM(req.Prompt, req.Context)
    }
    
    if err != nil {
        return nil, err
    }

    // Return response
    response := map[string]interface{}{
        "content": completion,
        "tokens_used": 150,
    }
    return json.Marshal(response)
}
```

**After (HTTP-based endpoint handler):**
```go
func (p *Plugin) handleCompletionEndpoint(w http.ResponseWriter, r *http.Request, pluginID, userID string, responseSchema []byte) {
    // Read request body
    body, err := io.ReadAll(r.Body)
    if err != nil {
        http.Error(w, "failed to read request body", http.StatusBadRequest)
        return
    }
    defer r.Body.Close()
    
    // Parse request
    var req struct {
        Prompt  string `json:"prompt"`
        Context string `json:"context"`
    }
    if err := json.Unmarshal(body, &req); err != nil {
        http.Error(w, "invalid JSON", http.StatusBadRequest)
        return
    }

    // Authorization check (using endpoint path instead of method name)
    if !p.isAuthorized(pluginID, userID, "/api/v1/completion") {
        http.Error(w, "unauthorized", http.StatusForbidden)
        return
    }

    // Call LLM
    var completion string
    
    if responseSchema != nil {
        completion, err = p.callLLMWithSchema(req.Prompt, req.Context, responseSchema)
    } else {
        completion, err = p.callLLM(req.Prompt, req.Context)
    }
    
    if err != nil {
        http.Error(w, err.Error(), http.StatusInternalServerError)
        return
    }

    // Return response with appropriate headers
    response := map[string]interface{}{
        "content": completion,
        "tokens_used": 150,
    }
    responseJSON, _ := json.Marshal(response)
    
    w.Header().Set("Content-Type", "application/json")
    w.WriteHeader(http.StatusOK)
    w.Write(responseJSON)
}
```

**Key Changes**:
- Read request body from `r.Body` instead of receiving `[]byte` parameter
- Write response using `http.ResponseWriter` instead of returning `[]byte`
- Use HTTP status codes for errors (`http.Error()`, `http.StatusBadRequest`, etc.)
- Set appropriate HTTP headers (`Content-Type: application/json`)
- Use `pluginID` and `userID` parameters from headers instead of Context fields

---

### Step 4: Update Authorization Logic

**Before:**
```go
func (p *Plugin) isAuthorized(sourcePluginId, method string) bool {
    // Empty source = core server (always allowed)
    if sourcePluginId == "" {
        return true
    }

    // Define allowed plugins per method
    allowedPlugins := map[string][]string{
        "GenerateCompletion": {"com.mattermost.boards", "com.mattermost.playbooks"},
        "SummarizeChannel":   {},  // Only core allowed
    }

    allowed, exists := allowedPlugins[method]
    // ... rest of logic
}
```

**After:**
```go
func (p *Plugin) isAuthorized(pluginID, userID, endpoint string) bool {
    // Core server calls with valid user
    if pluginID == "com.mattermost.server" && userID != "" {
        return true
    }

    // Define allowed plugins per endpoint (use endpoint paths instead of method names)
    allowedPlugins := map[string][]string{
        "/api/v1/completion": {"com.mattermost.boards", "com.mattermost.playbooks"},
        "/api/v1/summarize":  {},  // Only core allowed
    }

    allowed, exists := allowedPlugins[endpoint]
    // ... rest of logic (unchanged)
}
```

**Key Changes**:
- Change parameter from `method string` to `endpoint string`
- Use endpoint paths like `"/api/v1/completion"` instead of method names like `"GenerateCompletion"`

---

### Step 5: Add Required Imports

Make sure you have these imports:
```go
import (
    "encoding/base64"  // For decoding response schema header
    "io"               // For reading request body
    "net/http"         // For HTTP handling
    // ... other imports
)
```

---

## Method Name to Endpoint Mapping

When migrating, map your old method names to RESTful endpoint paths:

| Old Method Name (RPC) | New Endpoint Path (REST) | HTTP Method |
|----------------------|--------------------------|-------------|
| `GenerateCompletion` | `/api/v1/completion` | POST |
| `SummarizeChannel` | `/api/v1/summarize` | POST |
| `GenerateSuggestions` | `/api/v1/suggest` | POST |
| `AnalyzeContent` | `/api/v1/analyze` | POST |

**Naming Conventions**:
- Use `/api/v1/` prefix for versioned APIs
- Use lowercase, hyphenated paths (REST convention)
- Use verbs for actions: `/completion`, `/summarize`, `/analyze`
- Keep paths simple and intuitive

---

## Testing Your Migration

### Test 1: Verify Endpoint Routing
```go
func TestServeHTTPBridgeCall(t *testing.T) {
    p := &Plugin{}
    
    // Create test request
    body := bytes.NewBufferString(`{"prompt": "test"}`)
    req := httptest.NewRequest("POST", "/api/v1/completion", body)
    req.Header.Set("X-Mattermost-Source-Plugin-Id", "test-plugin")
    req.Header.Set("Content-Type", "application/json")
    
    // Create response recorder
    w := httptest.NewRecorder()
    
    // Call ServeHTTP
    p.ServeHTTP(&plugin.Context{}, w, req)
    
    // Verify response
    assert.Equal(t, http.StatusOK, w.Code)
    assert.Contains(t, w.Body.String(), "content")
}
```

### Test 2: Verify Response Schema Handling
```go
func TestServeHTTPWithResponseSchema(t *testing.T) {
    p := &Plugin{}
    
    schema := []byte(`{"type": "object", "properties": {"result": {"type": "string"}}}`)
    encodedSchema := base64.StdEncoding.EncodeToString(schema)
    
    body := bytes.NewBufferString(`{"prompt": "test"}`)
    req := httptest.NewRequest("POST", "/api/v1/completion", body)
    req.Header.Set("X-Mattermost-Response-Schema", encodedSchema)
    
    w := httptest.NewRecorder()
    p.ServeHTTP(&plugin.Context{}, w, req)
    
    assert.Equal(t, http.StatusOK, w.Code)
    // Verify response matches schema
}
```

### Test 3: Verify Authorization
```go
func TestServeHTTPUnauthorized(t *testing.T) {
    p := &Plugin{}
    
    body := bytes.NewBufferString(`{"prompt": "test"}`)
    req := httptest.NewRequest("POST", "/api/v1/completion", body)
    req.Header.Set("X-Mattermost-Source-Plugin-Id", "unauthorized-plugin")
    
    w := httptest.NewRecorder()
    p.ServeHTTP(&plugin.Context{}, w, req)
    
    assert.Equal(t, http.StatusForbidden, w.Code)
}
```

---

## Calling Plugin Updates (Mattermost Core)

The core Mattermost server code that calls your plugin also needs to be updated:

**Before:**
```go
responseJSON, err := app.CallPluginFromCore(rctx, "mattermost-ai", "GenerateCompletion", requestJSON, schema)
```

**After:**
```go
responseJSON, err := app.CallPluginFromCore(rctx, "mattermost-ai", "/api/v1/completion", requestJSON, schema)
```

**Key Change**: Replace method name string with REST endpoint path.

---

## Common Migration Pitfalls

### 1. Forgetting to Read Request Body
❌ **Wrong:**
```go
func (p *Plugin) handleEndpoint(w http.ResponseWriter, r *http.Request, ...) {
    var req MyRequest
    json.Unmarshal(???, &req)  // Where does the data come from?
}
```

✅ **Correct:**
```go
func (p *Plugin) handleEndpoint(w http.ResponseWriter, r *http.Request, ...) {
    body, err := io.ReadAll(r.Body)
    if err != nil {
        http.Error(w, "failed to read body", http.StatusBadRequest)
        return
    }
    defer r.Body.Close()
    
    var req MyRequest
    json.Unmarshal(body, &req)
}
```

### 2. Forgetting to Set Content-Type Header
❌ **Wrong:**
```go
w.Write(responseJSON)  // No Content-Type header
```

✅ **Correct:**
```go
w.Header().Set("Content-Type", "application/json")
w.Write(responseJSON)
```

### 3. Returning Errors Instead of Using HTTP Status Codes
❌ **Wrong:**
```go
return nil, fmt.Errorf("not found")  // Can't return from HTTP handler
```

✅ **Correct:**
```go
http.Error(w, "not found", http.StatusNotFound)
return  // Exit handler early
```

### 4. Not Decoding Base64 Response Schema
❌ **Wrong:**
```go
responseSchema := r.Header.Get("X-Mattermost-Response-Schema")
// Using responseSchema directly will fail - it's base64-encoded!
```

✅ **Correct:**
```go
responseSchemaEncoded := r.Header.Get("X-Mattermost-Response-Schema")
var responseSchema []byte
if responseSchemaEncoded != "" {
    decoded, err := base64.StdEncoding.DecodeString(responseSchemaEncoded)
    if err == nil {
        responseSchema = decoded
    }
}
```

---

## Complete Example: Before and After

### Before (RPC-Based Complete Implementation)

```go
package main

import (
    "encoding/json"
    "fmt"
    "github.com/mattermost/mattermost/server/public/plugin"
)

type Plugin struct {
    plugin.MattermostPlugin
}

// ExecuteBridgeCall implements the RPC-based bridge hook
func (p *Plugin) ExecuteBridgeCall(c *plugin.Context, method string, request []byte, responseSchema []byte) ([]byte, error) {
    p.API.LogInfo("Bridge call", "method", method, "source", c.SourcePluginId)
    
    switch method {
    case "GenerateCompletion":
        return p.handleGenerateCompletion(c, request, responseSchema)
    default:
        return nil, fmt.Errorf("unknown method: %s", method)
    }
}

func (p *Plugin) handleGenerateCompletion(c *plugin.Context, request []byte, responseSchema []byte) ([]byte, error) {
    var req struct {
        Prompt string `json:"prompt"`
    }
    if err := json.Unmarshal(request, &req); err != nil {
        return nil, err
    }
    
    if !p.isAuthorized(c.SourcePluginId, "GenerateCompletion") {
        return nil, fmt.Errorf("unauthorized")
    }
    
    completion, err := p.generateCompletion(req.Prompt, responseSchema)
    if err != nil {
        return nil, err
    }
    
    return json.Marshal(map[string]string{"content": completion})
}

func (p *Plugin) isAuthorized(sourcePluginId, method string) bool {
    return sourcePluginId == "" || sourcePluginId == "com.mattermost.boards"
}
```

### After (HTTP-Based Complete Implementation)

```go
package main

import (
    "encoding/base64"
    "encoding/json"
    "io"
    "net/http"
    "github.com/mattermost/mattermost/server/public/plugin"
)

type Plugin struct {
    plugin.MattermostPlugin
}

// ServeHTTP handles HTTP requests including bridge calls
func (p *Plugin) ServeHTTP(c *plugin.Context, w http.ResponseWriter, r *http.Request) {
    // Extract bridge metadata from headers
    pluginID := r.Header.Get("Mattermost-Plugin-ID")  // "com.mattermost.server" for core, plugin ID for plugins
    userID := r.Header.Get("Mattermost-User-Id")
    responseSchemaEncoded := r.Header.Get("X-Mattermost-Response-Schema")
    
    // Decode response schema
    var responseSchema []byte
    if responseSchemaEncoded != "" {
        decoded, _ := base64.StdEncoding.DecodeString(responseSchemaEncoded)
        responseSchema = decoded
    }
    
    // Log bridge calls
    if pluginID != "" {
        p.API.LogInfo("Bridge call", "endpoint", r.URL.Path, "caller", pluginID, "user", userID)
    }
    
    // Route to endpoints
    switch r.URL.Path {
    case "/api/v1/completion":
        p.handleCompletionEndpoint(w, r, pluginID, userID, responseSchema)
        return
    default:
        http.Error(w, "not found", http.StatusNotFound)
    }
}

func (p *Plugin) handleCompletionEndpoint(w http.ResponseWriter, r *http.Request, pluginID, userID string, responseSchema []byte) {
    // Read request body
    body, err := io.ReadAll(r.Body)
    if err != nil {
        http.Error(w, "failed to read body", http.StatusBadRequest)
        return
    }
    defer r.Body.Close()
    
    // Parse request
    var req struct {
        Prompt string `json:"prompt"`
    }
    if err := json.Unmarshal(body, &req); err != nil {
        http.Error(w, "invalid JSON", http.StatusBadRequest)
        return
    }
    
    // Authorization
    if !p.isAuthorized(pluginID, userID, "/api/v1/completion") {
        http.Error(w, "unauthorized", http.StatusForbidden)
        return
    }
    
    // Generate completion
    completion, err := p.generateCompletion(req.Prompt, responseSchema)
    if err != nil {
        http.Error(w, err.Error(), http.StatusInternalServerError)
        return
    }
    
    // Return response
    response := map[string]string{"content": completion}
    responseJSON, _ := json.Marshal(response)
    
    w.Header().Set("Content-Type", "application/json")
    w.WriteHeader(http.StatusOK)
    w.Write(responseJSON)
}

func (p *Plugin) isAuthorized(pluginID, userID, endpoint string) bool {
    // Allow core server calls with valid user
    if pluginID == "com.mattermost.server" && userID != "" {
        return true
    }
    // Allow specific plugins
    return pluginID == "com.mattermost.boards" || pluginID == "com.mattermost.playbooks"
}
```

---

## Checklist for Migration

- [ ] Remove `ExecuteBridgeCall` method from plugin
- [ ] Add REST endpoint routing to `ServeHTTP`
- [ ] Convert all RPC method handlers to HTTP endpoint handlers
- [ ] Update authorization logic to use endpoint paths instead of method names
- [ ] Add proper HTTP error handling (status codes, `http.Error()`)
- [ ] Add `Content-Type: application/json` headers to responses
- [ ] Extract metadata from HTTP headers (`X-Mattermost-Source-Plugin-Id`, `X-Mattermost-Response-Schema`)
- [ ] Decode base64-encoded response schema header
- [ ] Add required imports (`encoding/base64`, `io`, `net/http`)
- [ ] Update tests to use HTTP testing utilities (`httptest.NewRequest`, `httptest.NewRecorder`)
- [ ] Update calling code to use REST endpoint paths instead of method names
- [ ] Test all endpoints with various scenarios (success, auth failure, invalid input)

---

## Support and Questions

- Review the complete specification: See `/server/spec.md` in the Mattermost repository
- Reference implementation: [Agents Plugin PR #416](https://github.com/mattermost/mattermost-plugin-agents/pull/416)
- For questions or issues, please open an issue in the Mattermost repository

---

**Migration Version**: 2.0  
**Last Updated**: October 21, 2025  
**Mattermost Server Version**: 11.1+

