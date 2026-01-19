// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package server

import (
	"context"
	"errors"
	"fmt"
	"io"
	"net/http"
	"sync"

	"google.golang.org/grpc"

	"github.com/mattermost/mattermost/server/public/plugin"
	pb "github.com/mattermost/mattermost/server/public/pluginapi/grpc/generated/go/pluginapiv1"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
)

const (
	// DefaultChunkSize is the default size for body chunks (64KB).
	// This matches gRPC best practices for streaming.
	DefaultChunkSize = 64 * 1024
)

// ErrInvalidStatusCode is returned when a plugin sends an invalid HTTP status code.
var ErrInvalidStatusCode = errors.New("invalid http status code")

// ServeHTTPCaller handles ServeHTTP hook invocations over gRPC.
// It streams HTTP request bodies to Python plugins and receives
// streaming responses.
type ServeHTTPCaller struct {
	client    pb.PluginHooksClient
	chunkSize int
	log       *mlog.Logger
}

// NewServeHTTPCaller creates a new ServeHTTPCaller.
func NewServeHTTPCaller(conn grpc.ClientConnInterface) *ServeHTTPCaller {
	log, _ := mlog.NewLogger()
	return &ServeHTTPCaller{
		client:    pb.NewPluginHooksClient(conn),
		chunkSize: DefaultChunkSize,
		log:       log,
	}
}

// NewServeHTTPCallerWithLogger creates a new ServeHTTPCaller with a custom logger.
func NewServeHTTPCallerWithLogger(conn grpc.ClientConnInterface, log *mlog.Logger) *ServeHTTPCaller {
	return &ServeHTTPCaller{
		client:    pb.NewPluginHooksClient(conn),
		chunkSize: DefaultChunkSize,
		log:       log,
	}
}

// ServeHTTP streams an HTTP request to the Python plugin and writes the response.
// It handles:
// - Streaming request body in chunks (no buffering of entire body)
// - Propagating context cancellation from HTTP client disconnect
// - Streaming response body from plugin back to http.ResponseWriter
// - Full-duplex operation: plugin can respond before request body is fully consumed
// - Flush support: best-effort flushing when underlying writer supports http.Flusher
// - Invalid status code protection: returns 500 if status code is outside 100-999 range
func (c *ServeHTTPCaller) ServeHTTP(ctx context.Context, pluginCtx *plugin.Context, w http.ResponseWriter, r *http.Request) error {
	// Use request context which propagates HTTP client disconnects
	ctx = r.Context()

	// Start bidirectional stream
	stream, err := c.client.ServeHTTP(ctx)
	if err != nil {
		return err
	}

	// cancelSend is used to signal the request sender to stop
	// This enables early response: if plugin responds before we finish
	// sending the request body, we stop sending.
	cancelCtx, cancelSend := context.WithCancel(ctx)
	defer cancelSend()

	// Channel for errors from send goroutine
	sendErrCh := make(chan error, 1)

	// WaitGroup to ensure send goroutine finishes before we return
	var wg sync.WaitGroup
	wg.Add(1)

	// Send request in a goroutine
	go func() {
		defer wg.Done()
		sendErrCh <- c.sendRequest(cancelCtx, stream, pluginCtx, r)
	}()

	// Receive response (blocking until we get init or error)
	firstResp, err := c.receiveFirstResponse(stream)
	if err != nil {
		// Signal sender to stop and wait for it
		cancelSend()
		wg.Wait()
		// If plugin aborted before sending response-init, return 500
		c.writeErrorResponse(w, http.StatusInternalServerError, "plugin did not send response")
		return err
	}

	// Write response headers with status code validation
	if err := c.writeResponseHeaders(w, firstResp.GetInit()); err != nil {
		// Invalid status code - already wrote 500 response
		cancelSend()
		wg.Wait()
		return err
	}

	// Write first body chunk if present
	if len(firstResp.GetBodyChunk()) > 0 {
		if _, err := w.Write(firstResp.GetBodyChunk()); err != nil {
			cancelSend()
			wg.Wait()
			return err
		}
	}

	// Handle flush on first message if requested
	if firstResp.GetFlush() {
		c.flush(w)
	}

	// If first response was complete, we're done
	if firstResp.GetBodyComplete() {
		// Signal sender to stop (early response) and wait
		cancelSend()
		wg.Wait()
		return nil
	}

	// Stream remaining response body
	if err := c.streamResponseBody(stream, w); err != nil {
		cancelSend()
		wg.Wait()
		return err
	}

	// Wait for sender to finish and check for send errors
	// Note: we don't cancel here since streaming completed normally
	wg.Wait()

	// Check for send error (non-blocking since goroutine has finished)
	select {
	case sendErr := <-sendErrCh:
		if sendErr != nil && !errors.Is(sendErr, context.Canceled) {
			// Only return send error if it wasn't due to our cancellation
			return sendErr
		}
	default:
	}

	return nil
}

// sendRequest sends the HTTP request to the plugin as a stream of messages.
// The ctx parameter allows cancellation when plugin responds early.
func (c *ServeHTTPCaller) sendRequest(ctx context.Context, stream pb.PluginHooks_ServeHTTPClient, pluginCtx *plugin.Context, r *http.Request) error {
	defer stream.CloseSend()

	// Build request init with metadata
	init := c.buildRequestInit(pluginCtx, r)

	// Handle nil body case
	if r.Body == nil {
		// Send single message with init and body_complete=true
		return stream.Send(&pb.ServeHTTPRequest{
			Init:         init,
			BodyComplete: true,
		})
	}
	defer r.Body.Close()

	// Read body in chunks
	buf := make([]byte, c.chunkSize)
	firstMessage := true

	for {
		// Check both contexts before reading:
		// - stream.Context(): cancelled on HTTP client disconnect
		// - ctx: cancelled when plugin responds early
		select {
		case <-stream.Context().Done():
			return stream.Context().Err()
		case <-ctx.Done():
			return ctx.Err()
		default:
		}

		n, err := r.Body.Read(buf)
		isEOF := err == io.EOF

		if firstMessage {
			// First message includes init
			msg := &pb.ServeHTTPRequest{
				Init:         init,
				BodyComplete: isEOF,
			}
			if n > 0 {
				msg.BodyChunk = buf[:n]
			}
			if sendErr := stream.Send(msg); sendErr != nil {
				return sendErr
			}
			firstMessage = false
		} else if n > 0 || isEOF {
			// Subsequent messages are body chunks only
			// Send final message even if n==0 to set body_complete flag
			msg := &pb.ServeHTTPRequest{
				BodyComplete: isEOF,
			}
			if n > 0 {
				msg.BodyChunk = buf[:n]
			}
			if sendErr := stream.Send(msg); sendErr != nil {
				return sendErr
			}
		}

		if isEOF {
			break
		}
		if err != nil {
			return err
		}
	}

	return nil
}

// buildRequestInit creates the ServeHTTPRequestInit from an http.Request.
func (c *ServeHTTPCaller) buildRequestInit(pluginCtx *plugin.Context, r *http.Request) *pb.ServeHTTPRequestInit {
	init := &pb.ServeHTTPRequestInit{
		Method:        r.Method,
		Url:           r.URL.String(),
		Proto:         r.Proto,
		ProtoMajor:    int32(r.ProtoMajor),
		ProtoMinor:    int32(r.ProtoMinor),
		Host:          r.Host,
		RemoteAddr:    r.RemoteAddr,
		RequestUri:    r.RequestURI,
		ContentLength: r.ContentLength,
		Headers:       convertHTTPHeaders(r.Header),
	}

	if pluginCtx != nil {
		init.PluginContext = &pb.PluginContext{
			SessionId:      pluginCtx.SessionId,
			RequestId:      pluginCtx.RequestId,
			IpAddress:      pluginCtx.IPAddress,
			AcceptLanguage: pluginCtx.AcceptLanguage,
			UserAgent:      pluginCtx.UserAgent,
		}
	}

	return init
}

// convertHTTPHeaders converts http.Header to proto HTTPHeader messages.
func convertHTTPHeaders(h http.Header) []*pb.HTTPHeader {
	headers := make([]*pb.HTTPHeader, 0, len(h))
	for key, values := range h {
		headers = append(headers, &pb.HTTPHeader{
			Key:    key,
			Values: values,
		})
	}
	return headers
}

// receiveFirstResponse receives the first response message containing headers.
// Returns the full message so caller can also process body chunk and flush flag.
func (c *ServeHTTPCaller) receiveFirstResponse(stream pb.PluginHooks_ServeHTTPClient) (*pb.ServeHTTPResponse, error) {
	resp, err := stream.Recv()
	if err != nil {
		return nil, err
	}
	return resp, nil
}

// writeResponseHeaders writes the HTTP response headers from the init message.
// Returns an error if the status code is invalid (outside 100-999 range).
// This matches the behavior in server/public/plugin/http.go to prevent panics.
func (c *ServeHTTPCaller) writeResponseHeaders(w http.ResponseWriter, init *pb.ServeHTTPResponseInit) error {
	if init == nil {
		// Default to 200 OK if no init
		w.WriteHeader(http.StatusOK)
		return nil
	}

	// Get status code with default
	statusCode := int(init.GetStatusCode())
	if statusCode == 0 {
		statusCode = http.StatusOK
	}

	// Validate status code range (same as net/http checkWriteHeaderCode)
	// This prevents plugins from crashing the server with a panic.
	if statusCode < 100 || statusCode > 999 {
		c.log.Error(fmt.Sprintf("Plugin tried to write an invalid http status code: %d. Returning 500.", statusCode))
		c.writeErrorResponse(w, http.StatusInternalServerError, "invalid status code from plugin")
		return ErrInvalidStatusCode
	}

	// Copy headers
	for _, h := range init.GetHeaders() {
		for _, v := range h.GetValues() {
			w.Header().Add(h.GetKey(), v)
		}
	}

	// Write status code
	w.WriteHeader(statusCode)
	return nil
}

// writeErrorResponse writes an error response to the ResponseWriter.
func (c *ServeHTTPCaller) writeErrorResponse(w http.ResponseWriter, statusCode int, message string) {
	w.Header().Set("Content-Type", "text/plain; charset=utf-8")
	w.WriteHeader(statusCode)
	_, _ = w.Write([]byte(message))
}

// flush performs a best-effort flush if the ResponseWriter supports http.Flusher.
// This matches the behavior in server/public/plugin/http.go.
func (c *ServeHTTPCaller) flush(w http.ResponseWriter) {
	if flusher, ok := w.(http.Flusher); ok {
		flusher.Flush()
	}
	// If the underlying writer doesn't support Flusher, silently ignore.
	// This matches the HTTP spec's "best effort" semantics.
}

// streamResponseBody streams the response body from gRPC to http.ResponseWriter.
// Handles body chunks and flush requests.
func (c *ServeHTTPCaller) streamResponseBody(stream pb.PluginHooks_ServeHTTPClient, w http.ResponseWriter) error {
	for {
		resp, err := stream.Recv()
		if err == io.EOF {
			return nil
		}
		if err != nil {
			return err
		}

		// Write body chunk
		if len(resp.GetBodyChunk()) > 0 {
			if _, err := w.Write(resp.GetBodyChunk()); err != nil {
				return err
			}
		}

		// Handle flush request
		if resp.GetFlush() {
			c.flush(w)
		}

		// Check for completion
		if resp.GetBodyComplete() {
			return nil
		}
	}
}
