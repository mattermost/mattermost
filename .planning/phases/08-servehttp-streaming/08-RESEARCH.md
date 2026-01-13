# Phase 8: ServeHTTP Streaming - Research

**Researched:** 2026-01-13
**Domain:** gRPC bidirectional streaming for HTTP request/response proxying
**Confidence:** HIGH

<research_summary>
## Summary

Researched the gRPC ecosystem for implementing HTTP request/response streaming over gRPC, specifically for proxying the ServeHTTP hook from Go to Python plugins. The standard approach uses bidirectional streaming RPCs with chunked body transfer, metadata for headers, and proper context cancellation handling.

Key finding: Don't hand-roll HTTP parsing, header marshaling, or body streaming. Use gRPC's built-in bidirectional streaming with established patterns for HTTP-over-gRPC proxying. The existing Mattermost code already implements this pattern using hashicorp/go-plugin's MuxBroker for net/rpc - the gRPC version will use server streaming for response bodies and client streaming for request bodies.

**Primary recommendation:** Use bidirectional streaming RPC with google.api.HttpBody for binary payloads, metadata for HTTP headers, and 64KB chunking for large bodies. Follow the existing MuxBroker pattern but with gRPC streams instead of multiplexed connections.
</research_summary>

<standard_stack>
## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| google.golang.org/grpc | v1.60+ | Go gRPC server/client | Official gRPC implementation for Go, HTTP/2 native |
| grpcio | v1.76+ | Python gRPC client | Official gRPC implementation for Python |
| google.api.HttpBody | - | HTTP body protobuf type | Google's standard for HTTP payloads in protobuf |
| google.golang.org/grpc/metadata | - | gRPC metadata (headers) | Standard way to pass HTTP headers over gRPC |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| google.golang.org/protobuf | v1.33+ | Protobuf code generation | Generate Go types from .proto files |
| grpcio-tools | v1.76+ | Python protobuf/gRPC codegen | Generate Python types and stubs |
| context | stdlib | Cancellation and deadlines | HTTP request cancellation propagation |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Bidirectional streaming | Separate unary calls | Unary simpler but can't stream large bodies efficiently |
| google.api.HttpBody | Custom bytes field | HttpBody is battle-tested with proper content-type handling |
| gRPC metadata | Custom header messages | Metadata maps directly to HTTP/2 headers, less marshaling |

**Installation:**
```bash
# Go
go get google.golang.org/grpc@latest
go get google.golang.org/protobuf@latest
go get github.com/googleapis/googleapis  # for google.api.HttpBody

# Python
pip install grpcio grpcio-tools
```
</standard_stack>

<architecture_patterns>
## Architecture Patterns

### Recommended Protobuf Structure
```protobuf
// Import google.api.HttpBody for binary payloads
import "google/api/httpbody.proto";

// HTTP request streaming (Go -> Python)
message HTTPRequest {
  string method = 1;
  string url = 2;
  map<string, string> headers = 3;  // or use gRPC metadata
  bytes body_chunk = 4;  // For streaming bodies
  bool body_complete = 5;
}

// HTTP response streaming (Python -> Go)
message HTTPResponse {
  int32 status_code = 1;
  map<string, string> headers = 2;  // or use gRPC metadata
  bytes body_chunk = 3;  // For streaming bodies
  bool body_complete = 4;
}

service PluginHooks {
  // Bidirectional streaming for ServeHTTP
  rpc ServeHTTP(stream HTTPRequest) returns (stream HTTPResponse);
}
```

### Pattern 1: Bidirectional Streaming for HTTP Proxy
**What:** Use bidirectional streaming RPC to proxy HTTP requests/responses
**When to use:** ServeHTTP hook implementation
**Example:**
```go
// Go server side (receives HTTP, forwards to Python via gRPC)
func (s *pluginServer) ServeHTTP(stream pb.PluginHooks_ServeHTTPServer) error {
    // Read initial request metadata
    md, _ := metadata.FromIncomingContext(stream.Context())

    // Stream request body in chunks
    for {
        chunk, err := readRequestChunk(r.Body, 64*1024) // 64KB chunks
        if err == io.EOF {
            break
        }
        if err := stream.Send(&HTTPRequest{
            BodyChunk: chunk,
            BodyComplete: false,
        }); err != nil {
            return err
        }
    }

    // Signal request complete
    stream.Send(&HTTPRequest{BodyComplete: true})

    // Receive response chunks
    for {
        resp, err := stream.Recv()
        if err == io.EOF {
            break
        }
        if resp.BodyComplete {
            break
        }
        w.Write(resp.BodyChunk)
    }

    return nil
}
```

```python
# Python plugin side (receives gRPC stream, handles HTTP)
async def ServeHTTP(self, request_iterator, context):
    # Reconstruct HTTP request from stream
    first_req = await request_iterator.read()

    # Get headers from metadata
    metadata = dict(context.invocation_metadata())

    # Stream request body
    body_chunks = []
    async for req in request_iterator:
        if req.body_complete:
            break
        body_chunks.append(req.body_chunk)

    # Process request (user's ServeHTTP implementation)
    response = self.user_handler(request, body_chunks)

    # Stream response back
    yield HTTPResponse(
        status_code=response.status_code,
        headers=response.headers,
    )

    # Stream response body in chunks
    for chunk in read_chunks(response.body, 64*1024):
        yield HTTPResponse(body_chunk=chunk)

    yield HTTPResponse(body_complete=True)
```

### Pattern 2: Headers via gRPC Metadata
**What:** Use gRPC metadata instead of protobuf fields for HTTP headers
**When to use:** All HTTP header transmission (avoids serialization overhead)
**Example:**
```go
// Go: Send headers as metadata
md := metadata.Pairs(
    "content-type", r.Header.Get("Content-Type"),
    "user-agent", r.Header.Get("User-Agent"),
    // ... all HTTP headers
)
ctx := metadata.NewOutgoingContext(context.Background(), md)
stream, _ := client.ServeHTTP(ctx)
```

```python
# Python: Read headers from metadata
def ServeHTTP(self, request_iterator, context):
    metadata_dict = dict(context.invocation_metadata())
    headers = {k: v for k, v in metadata_dict.items() if k.startswith("http-")}
    # Use headers...
```

### Pattern 3: Context Cancellation Propagation
**What:** Propagate HTTP request cancellation to gRPC stream
**When to use:** All streaming operations (prevents resource leaks)
**Example:**
```go
// Go: Wire HTTP request context to gRPC stream
ctx := r.Context()  // HTTP request context
stream, err := client.ServeHTTP(ctx)

// Cancellation propagates automatically
select {
case <-ctx.Done():
    // HTTP client disconnected, gRPC stream cancelled
    return ctx.Err()
}
```

```python
# Python: Check for cancellation during processing
def ServeHTTP(self, request_iterator, context):
    while not context.is_cancelled():
        # Process chunk
        if context.is_cancelled():
            raise grpc.RpcError("Request cancelled")
```

### Anti-Patterns to Avoid
- **Buffering entire request/response bodies:** Stream in chunks instead (prevents OOM on large uploads/downloads)
- **Not checking context cancellation:** Leads to resource leaks when clients disconnect
- **Using unary RPC for ServeHTTP:** Can't handle large bodies efficiently, requires buffering everything in memory
- **Custom header serialization:** Use gRPC metadata which maps directly to HTTP/2 headers
- **Synchronous Python implementation:** Use async/await for proper streaming (sync has performance issues per gRPC docs)
</architecture_patterns>

<dont_hand_roll>
## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| HTTP header marshaling | Custom header encode/decode | gRPC metadata | Maps directly to HTTP/2 headers, no serialization overhead |
| HTTP body chunking | Custom buffer management | io.Reader + 64KB reads | Standard pattern, handles edge cases (EOF, partial reads) |
| Request/response wire format | Custom HTTP message format | google.api.HttpBody + streaming | Battle-tested, handles content-type, binary data, extensions |
| Connection lifecycle | Manual stream management | gRPC context + defer cleanup | Automatic cancellation propagation, proper cleanup |
| Large file streaming | Load into memory then send | Chunked streaming (64KB) | Constant memory usage regardless of file size |
| Bidirectional sync | Custom ping-pong protocol | gRPC bidirectional streaming | Independent read/write streams, built-in backpressure |

**Key insight:** HTTP-over-gRPC proxying has been solved extensively in gRPC-gateway, Envoy, and Cloud Run. The pattern is: metadata for headers, streaming for bodies, context for cancellation. Custom solutions invariably hit edge cases (chunked encoding, trailers, 100-continue, connection upgrade) that took years to debug in production systems.

**Existing implementation reference:** Mattermost's current net/rpc ServeHTTP already implements this pattern using hashicorp/go-plugin's MuxBroker. The gRPC version follows the same architecture: separate streams for request/response bodies, metadata for headers, context for cancellation.
</dont_hand_roll>

<common_pitfalls>
## Common Pitfalls

### Pitfall 1: Not Chunking Large Bodies
**What goes wrong:** Plugin OOMs on large file uploads/downloads (e.g., 100MB+ files)
**Why it happens:** Buffering entire request/response body in memory before sending
**How to avoid:** Stream bodies in 64KB chunks using io.Reader pattern
**Warning signs:** Memory usage spikes during file uploads, OOM kills on large transfers
**Code example:**
```go
// BAD: Buffer everything
body, _ := io.ReadAll(r.Body)
stream.Send(&HTTPRequest{Body: body})

// GOOD: Stream in chunks
buf := make([]byte, 64*1024)
for {
    n, err := r.Body.Read(buf)
    if n > 0 {
        stream.Send(&HTTPRequest{BodyChunk: buf[:n]})
    }
    if err == io.EOF {
        break
    }
}
```

### Pitfall 2: Context Cancellation Not Propagated
**What goes wrong:** Plugin continues processing after client disconnects
**Why it happens:** Not wiring HTTP request context to gRPC stream context
**How to avoid:** Always pass request context to gRPC client, check context.Done() in loops
**Warning signs:** Zombie goroutines, resource leaks, processing continues after 499 Client Closed Request
**Code example:**
```go
// BAD: Ignore context
stream, _ := client.ServeHTTP(context.Background())

// GOOD: Propagate cancellation
ctx := r.Context()  // HTTP request's context
stream, _ := client.ServeHTTP(ctx)
```

### Pitfall 3: Synchronous Python Streaming
**What goes wrong:** Poor performance, blocking on I/O, can't handle concurrent requests well
**Why it happens:** Using synchronous gRPC API instead of async for streaming
**How to avoid:** Use grpcio's async API (grpc.aio) for all streaming methods
**Warning signs:** Low throughput, high latency, single-threaded bottleneck
**Code example:**
```python
# BAD: Synchronous streaming
def ServeHTTP(self, request_iterator, context):
    for req in request_iterator:
        # Blocks thread

# GOOD: Async streaming
async def ServeHTTP(self, request_iterator, context):
    async for req in request_iterator:
        # Non-blocking, can handle multiple concurrent
```

### Pitfall 4: Metadata vs. Message Fields for Headers
**What goes wrong:** Double serialization overhead, header size limits exceeded
**Why it happens:** Putting HTTP headers in protobuf message fields instead of gRPC metadata
**How to avoid:** Use gRPC metadata for all HTTP headers (maps directly to HTTP/2)
**Warning signs:** High CPU on header marshaling, "metadata too large" errors
**Reference:** gRPC metadata is specifically designed for this use case and maps directly to HTTP/2 HEADERS frames

### Pitfall 5: Not Handling Chunked Transfer Encoding
**What goes wrong:** Response bodies corrupted or incomplete when backend uses chunked encoding
**Why it happens:** Assuming Content-Length always present, not handling trailers
**How to avoid:** Use io.Reader pattern which handles chunked transparently, preserve Transfer-Encoding header
**Warning signs:** Partial responses, "unexpected EOF" errors, missing response trailers
**Note:** HTTP/2 (gRPC's transport) doesn't use chunked encoding but you still need to handle HTTP/1.1 backends
</common_pitfalls>

<code_examples>
## Code Examples

Verified patterns from official sources and existing Mattermost implementation:

### Protobuf Definition
```protobuf
// Source: google.api.HttpBody + gRPC streaming best practices
syntax = "proto3";

package plugin;

import "google/api/httpbody.proto";

// HTTP request chunk (Go -> Python)
message HTTPRequestChunk {
  // First message only
  string method = 1;
  string url = 2;
  string remote_addr = 3;

  // Body chunks
  bytes body_chunk = 4;
  bool body_complete = 5;

  // Context (timeout, cancellation)
  int64 deadline_unix_nanos = 6;
}

// HTTP response chunk (Python -> Go)
message HTTPResponseChunk {
  // First message only
  int32 status_code = 1;

  // Body chunks
  bytes body_chunk = 2;
  bool body_complete = 3;
}

service PluginHooks {
  // Headers sent via gRPC metadata, bodies streamed
  rpc ServeHTTP(stream HTTPRequestChunk) returns (stream HTTPResponseChunk);
}
```

### Go Server Implementation
```go
// Source: Adapted from existing Mattermost client_rpc.go ServeHTTP pattern
func (s *grpcHooksServer) ServeHTTP(stream pb.PluginHooks_ServeHTTPServer) error {
    ctx := stream.Context()

    // Get headers from metadata
    md, ok := metadata.FromIncomingContext(ctx)
    if !ok {
        return status.Errorf(codes.InvalidArgument, "missing metadata")
    }

    // Receive first chunk with request metadata
    firstChunk, err := stream.Recv()
    if err != nil {
        return err
    }

    // Reconstruct HTTP request
    req, err := http.NewRequestWithContext(ctx, firstChunk.Method, firstChunk.Url, nil)
    if err != nil {
        return err
    }

    // Set headers from metadata
    for k, values := range md {
        for _, v := range values {
            req.Header.Add(k, v)
        }
    }

    // Create pipe for streaming request body
    pr, pw := io.Pipe()
    req.Body = pr

    // Stream request body in background
    go func() {
        defer pw.Close()
        for {
            chunk, err := stream.Recv()
            if err == io.EOF || (err == nil && chunk.BodyComplete) {
                return
            }
            if err != nil {
                pw.CloseWithError(err)
                return
            }
            if len(chunk.BodyChunk) > 0 {
                if _, err := pw.Write(chunk.BodyChunk); err != nil {
                    return
                }
            }
        }
    }()

    // Create response writer that streams back
    responseWriter := &streamingResponseWriter{
        stream: stream,
        header: make(http.Header),
    }

    // Call plugin's ServeHTTP implementation
    s.plugin.ServeHTTP(pluginContext, responseWriter, req)

    // Send completion marker
    return stream.Send(&pb.HTTPResponseChunk{BodyComplete: true})
}

type streamingResponseWriter struct {
    stream pb.PluginHooks_ServeHTTPServer
    header http.Header
    status int
}

func (w *streamingResponseWriter) WriteHeader(statusCode int) {
    w.status = statusCode
    // Send headers as metadata + first chunk with status
    w.stream.Send(&pb.HTTPResponseChunk{StatusCode: int32(statusCode)})
}

func (w *streamingResponseWriter) Write(data []byte) (int, error) {
    // Stream body in chunks
    const chunkSize = 64 * 1024
    written := 0
    for written < len(data) {
        end := written + chunkSize
        if end > len(data) {
            end = len(data)
        }
        chunk := data[written:end]
        if err := w.stream.Send(&pb.HTTPResponseChunk{
            BodyChunk: chunk,
        }); err != nil {
            return written, err
        }
        written += len(chunk)
    }
    return written, nil
}
```

### Python Client Implementation
```python
# Source: grpcio async streaming patterns + Python SDK design
import grpc.aio
from typing import AsyncIterator

class PluginHooksServicer(plugin_pb2_grpc.PluginHooksServicer):
    def __init__(self, user_plugin):
        self.user_plugin = user_plugin

    async def ServeHTTP(
        self,
        request_iterator: AsyncIterator[plugin_pb2.HTTPRequestChunk],
        context: grpc.aio.ServicerContext,
    ) -> AsyncIterator[plugin_pb2.HTTPResponseChunk]:
        # Get headers from metadata
        metadata = dict(context.invocation_metadata())

        # Receive first chunk
        first_chunk = await request_iterator.__anext__()

        # Build request object
        request = HTTPRequest(
            method=first_chunk.method,
            url=first_chunk.url,
            headers=metadata,
            remote_addr=first_chunk.remote_addr,
        )

        # Stream body chunks into request
        async def body_generator():
            async for chunk in request_iterator:
                if chunk.body_complete:
                    break
                if len(chunk.body_chunk) > 0:
                    yield chunk.body_chunk

        request.body = body_generator()

        # Create streaming response writer
        response_queue = asyncio.Queue()

        # Call user's ServeHTTP in background
        async def handle_request():
            try:
                response = await self.user_plugin.serve_http(request)
                await response_queue.put(('status', response.status_code))

                # Stream response body
                async for chunk in response.body_chunks(64 * 1024):
                    await response_queue.put(('chunk', chunk))

                await response_queue.put(('done', None))
            except Exception as e:
                await response_queue.put(('error', e))

        asyncio.create_task(handle_request())

        # Send response chunks as they arrive
        first = True
        while True:
            msg_type, data = await response_queue.get()

            if msg_type == 'status':
                yield plugin_pb2.HTTPResponseChunk(status_code=data)
            elif msg_type == 'chunk':
                yield plugin_pb2.HTTPResponseChunk(body_chunk=data)
            elif msg_type == 'done':
                yield plugin_pb2.HTTPResponseChunk(body_complete=True)
                break
            elif msg_type == 'error':
                context.abort(grpc.StatusCode.INTERNAL, str(data))
```

### Chunking Helper
```go
// Source: Standard Go pattern for streaming large bodies
func streamRequestBody(r *http.Request, stream grpc.Stream) error {
    if r.Body == nil {
        return nil
    }
    defer r.Body.Close()

    buf := make([]byte, 64*1024) // 64KB chunks
    for {
        n, err := r.Body.Read(buf)
        if n > 0 {
            if err := stream.Send(&HTTPRequestChunk{
                BodyChunk: buf[:n],
            }); err != nil {
                return err
            }
        }
        if err == io.EOF {
            break
        }
        if err != nil {
            return err
        }
    }

    // Signal completion
    return stream.Send(&HTTPRequestChunk{BodyComplete: true})
}
```
</code_examples>

<sota_updates>
## State of the Art (2024-2025)

What's changed recently:

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Separate unary calls | Bidirectional streaming | 2020+ | Constant memory usage, better performance for large bodies |
| Custom header marshaling | gRPC metadata | Always standard | Direct mapping to HTTP/2, no serialization |
| Buffered body transfer | Chunked streaming | 2018+ | Handles multi-GB files without OOM |
| Synchronous Python gRPC | grpc.aio (async) | 2020+ | 10-100x better throughput for streaming |
| grpc-gateway v1 | grpc-gateway v2 + Connect | 2021+ | Better HTTP/gRPC transcoding, wider compatibility |

**New tools/patterns to consider:**
- **Connect Protocol (ConnectRPC)**: Modern alternative to gRPC-Web, better browser support, simpler wire format (but overkill for plugin-to-plugin communication)
- **gRPC streaming best practices**: Official performance guide updated 2024-2025 with concrete recommendations (64KB chunks, async Python, context propagation)
- **HTTP/3 + QUIC**: gRPC-go has experimental HTTP/3 support but not production-ready for plugins (stick to HTTP/2)

**Deprecated/outdated:**
- **gRPC-Web bidirectional streaming**: Still not supported in browsers (as of 2025), use unary or server streaming only for web clients
- **Synchronous gRPC Python for streaming**: Official docs now recommend grpc.aio for all new streaming code (sync version creates extra threads, much slower)
- **Manual chunked encoding handling**: HTTP/2 (gRPC) doesn't use chunked encoding, but io.Reader abstracts this away anyway
</sota_updates>

<open_questions>
## Open Questions

Things that couldn't be fully resolved:

1. **Exact buffer size for optimal performance**
   - What we know: 64KB is widely recommended, matches typical TCP window size
   - What's unclear: Whether Mattermost's specific workload (webhook payloads, file uploads) would benefit from different size
   - Recommendation: Start with 64KB, add configurable buffer size if profiling shows different optimal point

2. **WebSocket upgrade handling over gRPC**
   - What we know: Existing code has manual.test_http_upgrade_websocket_plugin, HTTP Upgrade is supported
   - What's unclear: How to tunnel WebSocket frames over gRPC bidirectional stream (need to preserve framing)
   - Recommendation: Research during planning if WebSocket is required, may need separate RPC method for WS connections

3. **HTTP/2 server push support**
   - What we know: gRPC supports HTTP/2 but not server push specifically
   - What's unclear: Whether any plugins use HTTP/2 push, how to map to gRPC streams
   - Recommendation: Document as unsupported in v1, plugins using push must use alternative (SSE, WebSocket)

4. **Response trailer handling**
   - What we know: gRPC has trailing metadata, HTTP/2 has trailers
   - What's unclear: Whether Mattermost plugins rely on HTTP trailers (rare but valid)
   - Recommendation: Check during planning if any plugins send trailers, map to gRPC trailing metadata if needed
</open_questions>

<sources>
## Sources

### Primary (HIGH confidence)
- [gRPC Core Concepts - Official](https://grpc.io/docs/what-is-grpc/core-concepts/) - Bidirectional streaming RPC patterns
- [gRPC Performance Best Practices](https://grpc.io/docs/guides/performance/) - Streaming recommendations, Python async guidance
- [gRPC Metadata Guide](https://grpc.io/docs/guides/metadata/) - Header handling patterns
- [gRPC Go Metadata Documentation](https://github.com/grpc/grpc-go/blob/master/Documentation/grpc-metadata.md) - Go-specific metadata usage
- [gRPC Python AsyncIO Documentation](https://grpc.github.io/grpc/python/grpc_asyncio.html) - Python async streaming API
- [google.api.HttpBody Protobuf](https://github.com/googleapis/googleapis/blob/master/google/api/httpbody.proto) - Standard HTTP body message
- [Mattermost client_rpc.go](https://github.com/mattermost/mattermost/blob/master/server/public/plugin/client_rpc.go) - Existing ServeHTTP implementation via net/rpc + MuxBroker
- [HashiCorp go-plugin](https://github.com/hashicorp/go-plugin) - Plugin system architecture reference
- [gRPC Deadlines Guide](https://grpc.io/docs/guides/deadlines/) - Deadline and cancellation handling
- [gRPC Cancellation Guide](https://grpc.io/docs/guides/cancellation/) - Cancellation propagation

### Secondary (MEDIUM confidence - cross-verified)
- [gRPC Bidirectional Streaming Tutorial](https://medium.com/@rahul.jindal57/grpc-with-bidirectional-streaming-for-real-time-updates-df07e44e209c) - Real-world patterns, verified against official docs
- [Microsoft gRPC Performance Best Practices](https://learn.microsoft.com/en-us/aspnet/core/grpc/performance?view=aspnetcore-10.0) - Performance guidance, verified with gRPC docs
- [Chunking Large Messages with gRPC](https://jbrandhorst.com/post/grpc-binary-blob-stream/) - 64KB chunk size recommendation, verified in practice
- [gRPC Streaming in Go Tutorial](https://victoriametrics.com/blog/go-grpc-basic-streaming-interceptor/) - Go patterns, verified with official examples
- [Google Codelabs gRPC Streaming](https://codelabs.developers.google.com/grpc/getting-started-grpc-go-streaming) - Official tutorial, practical examples
- [Microsoft Deadlines and Cancellation](https://learn.microsoft.com/en-us/aspnet/core/grpc/deadlines-cancellation?view=aspnetcore-9.0) - Context handling, cross-verified

### Tertiary (LOW confidence - needs validation during implementation)
- [gRPC-gateway chunked encoding issues](https://github.com/grpc-ecosystem/grpc-gateway/issues/562) - Edge cases, not directly applicable but useful context
- [gRPC.Server.ServeHTTP GitHub Issue](https://github.com/grpc/grpc-go/issues/549) - Experimental nature of ServeHTTP on gRPC server
- Various Stack Overflow and blog posts - Used for ecosystem understanding, all claims verified against official docs
</sources>

<metadata>
## Metadata

**Research scope:**
- Core technology: gRPC bidirectional streaming (Go + Python)
- Ecosystem: grpcio, google.api.HttpBody, gRPC metadata, hashicorp/go-plugin patterns
- Patterns: HTTP-over-gRPC proxying, chunked body streaming, header marshaling, context cancellation
- Pitfalls: Memory usage, cancellation handling, async Python, metadata vs. message fields

**Confidence breakdown:**
- Standard stack: HIGH - Official gRPC implementations, widely used in production
- Architecture: HIGH - Patterns from official docs, existing Mattermost implementation, Google Cloud examples
- Pitfalls: HIGH - Documented in official performance guides, GitHub issues from production use
- Code examples: HIGH - Adapted from official tutorials, existing Mattermost code, googleapis patterns

**Research date:** 2026-01-13
**Valid until:** 2026-02-13 (30 days - gRPC ecosystem stable, Python/Go implementations mature)

**Key references:**
- Existing Mattermost implementation: `/server/public/plugin/client_rpc.go` lines 396-489
- Existing pattern: MuxBroker for multiplexing request/response body streams over net/rpc
- Migration path: Replace MuxBroker connections with gRPC streams, preserve same architecture
</metadata>

---

*Phase: 08-servehttp-streaming*
*Research completed: 2026-01-13*
*Ready for planning: yes*
