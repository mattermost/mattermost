// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package server

import (
	"context"
	"io"
	"net/http"

	"google.golang.org/grpc"

	"github.com/mattermost/mattermost/server/public/plugin"
	pb "github.com/mattermost/mattermost/server/public/pluginapi/grpc/generated/go/pluginapiv1"
)

const (
	// DefaultChunkSize is the default size for body chunks (64KB).
	// This matches gRPC best practices for streaming.
	DefaultChunkSize = 64 * 1024
)

// ServeHTTPCaller handles ServeHTTP hook invocations over gRPC.
// It streams HTTP request bodies to Python plugins and receives
// streaming responses.
type ServeHTTPCaller struct {
	client    pb.PluginHooksClient
	chunkSize int
}

// NewServeHTTPCaller creates a new ServeHTTPCaller.
func NewServeHTTPCaller(conn grpc.ClientConnInterface) *ServeHTTPCaller {
	return &ServeHTTPCaller{
		client:    pb.NewPluginHooksClient(conn),
		chunkSize: DefaultChunkSize,
	}
}

// ServeHTTP streams an HTTP request to the Python plugin and writes the response.
// It handles:
// - Streaming request body in chunks (no buffering of entire body)
// - Propagating context cancellation from HTTP client disconnect
// - Streaming response body from plugin back to http.ResponseWriter
//
// Note: This is a temporary implementation for Phase 8.1. Response streaming
// will be improved in Phase 8.2 to avoid buffering.
func (c *ServeHTTPCaller) ServeHTTP(ctx context.Context, pluginCtx *plugin.Context, w http.ResponseWriter, r *http.Request) error {
	// Use request context which propagates HTTP client disconnects
	ctx = r.Context()

	// Start bidirectional stream
	stream, err := c.client.ServeHTTP(ctx)
	if err != nil {
		return err
	}

	// Channel for errors from goroutines
	errCh := make(chan error, 2)

	// Send request in a goroutine
	go func() {
		errCh <- c.sendRequest(stream, pluginCtx, r)
	}()

	// Receive response (blocking until we get init or error)
	respInit, err := c.receiveResponseInit(stream)
	if err != nil {
		// Wait for sender to finish
		<-errCh
		return err
	}

	// Write response headers
	c.writeResponseHeaders(w, respInit)

	// Stream response body
	if err := c.streamResponseBody(stream, w); err != nil {
		<-errCh
		return err
	}

	// Check for send errors
	if err := <-errCh; err != nil {
		return err
	}

	return nil
}

// sendRequest sends the HTTP request to the plugin as a stream of messages.
func (c *ServeHTTPCaller) sendRequest(stream pb.PluginHooks_ServeHTTPClient, pluginCtx *plugin.Context, r *http.Request) error {
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
		// Check context before reading
		select {
		case <-stream.Context().Done():
			return stream.Context().Err()
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

// receiveResponseInit receives the first response message containing headers.
func (c *ServeHTTPCaller) receiveResponseInit(stream pb.PluginHooks_ServeHTTPClient) (*pb.ServeHTTPResponseInit, error) {
	resp, err := stream.Recv()
	if err != nil {
		return nil, err
	}
	return resp.GetInit(), nil
}

// writeResponseHeaders writes the HTTP response headers from the init message.
func (c *ServeHTTPCaller) writeResponseHeaders(w http.ResponseWriter, init *pb.ServeHTTPResponseInit) {
	if init == nil {
		// Default to 200 OK if no init
		w.WriteHeader(http.StatusOK)
		return
	}

	// Copy headers
	for _, h := range init.GetHeaders() {
		for _, v := range h.GetValues() {
			w.Header().Add(h.GetKey(), v)
		}
	}

	// Write status code
	statusCode := int(init.GetStatusCode())
	if statusCode == 0 {
		statusCode = http.StatusOK
	}
	w.WriteHeader(statusCode)
}

// streamResponseBody streams the response body from gRPC to http.ResponseWriter.
// TODO(08-02): Implement true streaming with Flush() support.
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

		// Check for completion
		if resp.GetBodyComplete() {
			return nil
		}
	}
}
