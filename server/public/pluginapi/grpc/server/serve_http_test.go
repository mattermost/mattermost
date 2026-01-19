// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package server

import (
	"bytes"
	"context"
	"io"
	"net/http"
	"strings"
	"sync"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"google.golang.org/grpc/metadata"

	"github.com/mattermost/mattermost/server/public/plugin"
	pb "github.com/mattermost/mattermost/server/public/pluginapi/grpc/generated/go/pluginapiv1"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
)

// =============================================================================
// Helper Classes
// =============================================================================

// mockServeHTTPStream implements the bidirectional streaming interface for testing
type mockServeHTTPStream struct {
	ctx              context.Context
	requests         []*pb.ServeHTTPRequest
	responses        []*pb.ServeHTTPResponse
	currentRespIndex int
	sendErr          error
	recvErr          error
	closed           bool
}

func (s *mockServeHTTPStream) Send(req *pb.ServeHTTPRequest) error {
	if s.sendErr != nil {
		return s.sendErr
	}
	s.requests = append(s.requests, req)
	return nil
}

func (s *mockServeHTTPStream) Recv() (*pb.ServeHTTPResponse, error) {
	if s.recvErr != nil {
		return nil, s.recvErr
	}
	if s.currentRespIndex >= len(s.responses) {
		return nil, io.EOF
	}
	resp := s.responses[s.currentRespIndex]
	s.currentRespIndex++
	return resp, nil
}

func (s *mockServeHTTPStream) CloseSend() error {
	s.closed = true
	return nil
}

func (s *mockServeHTTPStream) Context() context.Context {
	return s.ctx
}

func (s *mockServeHTTPStream) Header() (metadata.MD, error) {
	return nil, nil
}

func (s *mockServeHTTPStream) Trailer() metadata.MD {
	return nil
}

func (s *mockServeHTTPStream) RecvMsg(m interface{}) error {
	return nil
}

func (s *mockServeHTTPStream) SendMsg(m interface{}) error {
	return nil
}

// =============================================================================
// Unit Tests for Helper Functions
// =============================================================================

func TestConvertHTTPHeaders(t *testing.T) {
	tests := []struct {
		name     string
		input    http.Header
		expected int
	}{
		{
			name:     "empty headers",
			input:    http.Header{},
			expected: 0,
		},
		{
			name: "single value header",
			input: http.Header{
				"Content-Type": []string{"application/json"},
			},
			expected: 1,
		},
		{
			name: "multi-value header",
			input: http.Header{
				"Accept":     []string{"text/html", "application/json"},
				"Set-Cookie": []string{"a=1", "b=2"},
			},
			expected: 2,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			result := convertHTTPHeaders(tc.input)
			assert.Len(t, result, tc.expected)

			// Verify values are preserved
			for _, h := range result {
				original := tc.input[h.Key]
				assert.Equal(t, original, h.Values)
			}
		})
	}
}

func TestBuildRequestInit(t *testing.T) {
	caller := &ServeHTTPCaller{chunkSize: DefaultChunkSize}

	tests := []struct {
		name       string
		method     string
		url        string
		headers    http.Header
		pluginCtx  *plugin.Context
		wantMethod string
		wantURL    string
	}{
		{
			name:       "GET request",
			method:     "GET",
			url:        "/plugins/myplugin/api/v1/hello",
			headers:    http.Header{"Accept": []string{"application/json"}},
			pluginCtx:  &plugin.Context{SessionId: "session123", RequestId: "req123"},
			wantMethod: "GET",
			wantURL:    "/plugins/myplugin/api/v1/hello",
		},
		{
			name:       "POST request with body",
			method:     "POST",
			url:        "/plugins/myplugin/api/v1/create",
			headers:    http.Header{"Content-Type": []string{"application/json"}},
			pluginCtx:  nil,
			wantMethod: "POST",
			wantURL:    "/plugins/myplugin/api/v1/create",
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			req, err := http.NewRequest(tc.method, tc.url, nil)
			require.NoError(t, err)
			req.Header = tc.headers

			init := caller.buildRequestInit(tc.pluginCtx, req)

			assert.Equal(t, tc.wantMethod, init.Method)
			assert.Equal(t, tc.wantURL, init.Url)

			if tc.pluginCtx != nil {
				assert.NotNil(t, init.PluginContext)
				assert.Equal(t, tc.pluginCtx.SessionId, init.PluginContext.SessionId)
				assert.Equal(t, tc.pluginCtx.RequestId, init.PluginContext.RequestId)
			}
		})
	}
}

// =============================================================================
// Chunking Tests
// =============================================================================

func TestChunking_SmallBody(t *testing.T) {
	// Body smaller than chunk size
	// Note: strings.Reader returns data first, then EOF on next read
	// So we get 2 messages: first with init+data, second with body_complete
	body := strings.Repeat("a", 100) // 100 bytes

	requests := simulateSendRequest(t, body, DefaultChunkSize)

	// Verify we get at least 1 message
	require.GreaterOrEqual(t, len(requests), 1)

	// First message has init and body
	assert.NotNil(t, requests[0].Init)
	assert.Equal(t, []byte(body), requests[0].BodyChunk)

	// Last message has body_complete flag
	assert.True(t, requests[len(requests)-1].BodyComplete)

	// Verify total content
	var totalBody []byte
	for _, req := range requests {
		totalBody = append(totalBody, req.BodyChunk...)
	}
	assert.Equal(t, body, string(totalBody))
}

func TestChunking_ExactChunkSize(t *testing.T) {
	// Body exactly chunk size
	chunkSize := 1024
	body := strings.Repeat("b", chunkSize)

	requests := simulateSendRequest(t, body, chunkSize)

	// Verify we have at least 1 message
	require.GreaterOrEqual(t, len(requests), 1)

	// First message has init
	assert.NotNil(t, requests[0].Init)

	// Last message has completion flag
	assert.True(t, requests[len(requests)-1].BodyComplete)

	// Verify total content
	var totalBody []byte
	for _, req := range requests {
		totalBody = append(totalBody, req.BodyChunk...)
	}
	assert.Equal(t, chunkSize, len(totalBody))
}

func TestChunking_MultipleChunks(t *testing.T) {
	// Body larger than chunk size should be split
	chunkSize := 100
	body := strings.Repeat("c", 250) // 250 bytes = 3 data chunks

	requests := simulateSendRequest(t, body, chunkSize)

	// Should have at least 3 messages (could have +1 for EOF marker)
	require.GreaterOrEqual(t, len(requests), 3)

	// First message has init
	assert.NotNil(t, requests[0].Init)
	assert.Equal(t, chunkSize, len(requests[0].BodyChunk))

	// Only first message has init
	for i := 1; i < len(requests); i++ {
		assert.Nil(t, requests[i].Init)
	}

	// Last message has completion flag
	assert.True(t, requests[len(requests)-1].BodyComplete)

	// Verify total content
	var totalBody []byte
	for _, req := range requests {
		totalBody = append(totalBody, req.BodyChunk...)
	}
	assert.Equal(t, body, string(totalBody))
}

func TestChunking_EmptyBody(t *testing.T) {
	// Empty body (nil)
	requests := simulateSendRequest(t, "", 1024)

	require.Len(t, requests, 1)
	assert.NotNil(t, requests[0].Init)
	assert.Empty(t, requests[0].BodyChunk)
	assert.True(t, requests[0].BodyComplete)
}

func TestChunking_LargeBody(t *testing.T) {
	// Large body (1MB) with default chunk size
	bodySize := 1024 * 1024 // 1MB
	body := strings.Repeat("d", bodySize)

	requests := simulateSendRequest(t, body, DefaultChunkSize)

	// Verify first has init
	assert.NotNil(t, requests[0].Init)

	// Verify last has completion flag
	assert.True(t, requests[len(requests)-1].BodyComplete)

	// Verify total content
	var totalBody []byte
	for _, req := range requests {
		totalBody = append(totalBody, req.BodyChunk...)
	}
	assert.Equal(t, bodySize, len(totalBody))
}

// simulateSendRequest simulates the sendRequest method and collects sent messages
func simulateSendRequest(t *testing.T, body string, chunkSize int) []*pb.ServeHTTPRequest {
	t.Helper()

	// Create a mock stream that collects requests
	stream := &mockServeHTTPStream{
		ctx:      context.Background(),
		requests: make([]*pb.ServeHTTPRequest, 0),
	}

	// Create a real HTTP request
	var reqBody io.Reader
	if body != "" {
		reqBody = strings.NewReader(body)
	}
	httpReq, err := http.NewRequest("POST", "/test", reqBody)
	require.NoError(t, err)

	// Create caller with custom chunk size
	caller := &ServeHTTPCaller{chunkSize: chunkSize}

	// Call sendRequest directly with context
	err = caller.sendRequest(context.Background(), stream, nil, httpReq)
	require.NoError(t, err)

	// Return collected requests from the stream
	return stream.requests
}

// =============================================================================
// Response Handling Tests
// =============================================================================

func TestWriteResponseHeaders(t *testing.T) {
	log, _ := mlog.NewLogger()
	caller := &ServeHTTPCaller{log: log}

	tests := []struct {
		name           string
		init           *pb.ServeHTTPResponseInit
		expectedStatus int
		expectError    bool
	}{
		{
			name:           "nil init returns 200",
			init:           nil,
			expectedStatus: 200,
			expectError:    false,
		},
		{
			name: "status code 200",
			init: &pb.ServeHTTPResponseInit{
				StatusCode: 200,
				Headers:    []*pb.HTTPHeader{{Key: "Content-Type", Values: []string{"text/plain"}}},
			},
			expectedStatus: 200,
			expectError:    false,
		},
		{
			name: "status code 404",
			init: &pb.ServeHTTPResponseInit{
				StatusCode: 404,
			},
			expectedStatus: 404,
			expectError:    false,
		},
		{
			name: "status code 0 defaults to 200",
			init: &pb.ServeHTTPResponseInit{
				StatusCode: 0,
			},
			expectedStatus: 200,
			expectError:    false,
		},
		{
			name: "status code 100 is valid",
			init: &pb.ServeHTTPResponseInit{
				StatusCode: 100,
			},
			expectedStatus: 100,
			expectError:    false,
		},
		{
			name: "status code 999 is valid",
			init: &pb.ServeHTTPResponseInit{
				StatusCode: 999,
			},
			expectedStatus: 999,
			expectError:    false,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			w := &mockResponseWriter{headers: make(http.Header)}
			err := caller.writeResponseHeaders(w, tc.init)

			if tc.expectError {
				assert.Error(t, err)
			} else {
				assert.NoError(t, err)
				assert.Equal(t, tc.expectedStatus, w.statusCode)

				if tc.init != nil {
					for _, h := range tc.init.Headers {
						for _, v := range h.Values {
							assert.Contains(t, w.headers.Values(h.Key), v)
						}
					}
				}
			}
		})
	}
}

// mockResponseWriter implements http.ResponseWriter for testing
type mockResponseWriter struct {
	headers    http.Header
	statusCode int
	body       bytes.Buffer
}

func (w *mockResponseWriter) Header() http.Header {
	return w.headers
}

func (w *mockResponseWriter) Write(b []byte) (int, error) {
	return w.body.Write(b)
}

func (w *mockResponseWriter) WriteHeader(statusCode int) {
	w.statusCode = statusCode
}

// =============================================================================
// Context Cancellation Tests
// =============================================================================

func TestContextCancellation_DuringBodyRead(t *testing.T) {
	// Create a cancellable context
	ctx, cancel := context.WithCancel(context.Background())

	// Create a reader that blocks, then cancel
	slowReader := &slowReader{
		data:     []byte(strings.Repeat("e", 1000)),
		blockAt:  500,
		cancelFn: cancel,
	}

	httpReq, err := http.NewRequestWithContext(ctx, "POST", "/test", slowReader)
	require.NoError(t, err)

	stream := &mockServeHTTPStream{
		ctx:      ctx,
		requests: make([]*pb.ServeHTTPRequest, 0),
	}

	caller := &ServeHTTPCaller{chunkSize: 100}

	// sendRequest should return context error when cancelled
	err = caller.sendRequest(ctx, stream, nil, httpReq)
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "context canceled")
}

// slowReader is a reader that cancels context after reading some bytes
type slowReader struct {
	data     []byte
	offset   int
	blockAt  int
	cancelFn context.CancelFunc
}

func (r *slowReader) Read(p []byte) (int, error) {
	if r.offset >= r.blockAt && r.cancelFn != nil {
		r.cancelFn()
		r.cancelFn = nil // Only cancel once
		return 0, context.Canceled
	}

	if r.offset >= len(r.data) {
		return 0, io.EOF
	}

	n := copy(p, r.data[r.offset:])
	r.offset += n
	return n, nil
}

// =============================================================================
// Invalid Status Code Tests (Phase 8.2)
// =============================================================================

func TestInvalidStatusCode_TooLow(t *testing.T) {
	// Status code 42 (below 100) should return error
	log, _ := mlog.NewLogger()
	caller := &ServeHTTPCaller{log: log}

	w := &mockResponseWriter{headers: make(http.Header)}
	err := caller.writeResponseHeaders(w, &pb.ServeHTTPResponseInit{
		StatusCode: 42,
	})

	assert.Error(t, err)
	assert.Equal(t, ErrInvalidStatusCode, err)
	// Should write 500 response
	assert.Equal(t, http.StatusInternalServerError, w.statusCode)
}

func TestInvalidStatusCode_TooHigh(t *testing.T) {
	// Status code 1000 (above 999) should return error
	log, _ := mlog.NewLogger()
	caller := &ServeHTTPCaller{log: log}

	w := &mockResponseWriter{headers: make(http.Header)}
	err := caller.writeResponseHeaders(w, &pb.ServeHTTPResponseInit{
		StatusCode: 1000,
	})

	assert.Error(t, err)
	assert.Equal(t, ErrInvalidStatusCode, err)
	// Should write 500 response
	assert.Equal(t, http.StatusInternalServerError, w.statusCode)
}

func TestInvalidStatusCode_DoesNotPanic(t *testing.T) {
	// Ensure invalid status codes never cause a panic
	log, _ := mlog.NewLogger()
	caller := &ServeHTTPCaller{log: log}

	invalidCodes := []int32{-1, 0, 42, 99, 1000, 1001, 65535}

	for _, code := range invalidCodes {
		t.Run(string(rune(code)), func(t *testing.T) {
			assert.NotPanics(t, func() {
				w := &mockResponseWriter{headers: make(http.Header)}
				// code 0 is special - it defaults to 200
				if code == 0 {
					err := caller.writeResponseHeaders(w, &pb.ServeHTTPResponseInit{
						StatusCode: code,
					})
					assert.NoError(t, err)
					assert.Equal(t, http.StatusOK, w.statusCode)
				} else if code < 100 || code > 999 {
					err := caller.writeResponseHeaders(w, &pb.ServeHTTPResponseInit{
						StatusCode: code,
					})
					assert.Error(t, err)
					assert.Equal(t, http.StatusInternalServerError, w.statusCode)
				}
			})
		})
	}
}

// =============================================================================
// Flush Tests (Phase 8.2)
// =============================================================================

// mockFlusherResponseWriter implements http.ResponseWriter and http.Flusher
type mockFlusherResponseWriter struct {
	mockResponseWriter
	flushCalled int
	mu          sync.Mutex
}

func (w *mockFlusherResponseWriter) Flush() {
	w.mu.Lock()
	defer w.mu.Unlock()
	w.flushCalled++
}

func (w *mockFlusherResponseWriter) FlushCount() int {
	w.mu.Lock()
	defer w.mu.Unlock()
	return w.flushCalled
}

func TestFlush_WithFlusher(t *testing.T) {
	// Test that flush is called when the ResponseWriter supports http.Flusher
	log, _ := mlog.NewLogger()
	caller := &ServeHTTPCaller{log: log}

	w := &mockFlusherResponseWriter{
		mockResponseWriter: mockResponseWriter{headers: make(http.Header)},
	}

	caller.flush(w)
	assert.Equal(t, 1, w.FlushCount())

	// Call flush multiple times
	caller.flush(w)
	caller.flush(w)
	assert.Equal(t, 3, w.FlushCount())
}

func TestFlush_WithoutFlusher(t *testing.T) {
	// Test that flush doesn't panic when ResponseWriter doesn't support http.Flusher
	log, _ := mlog.NewLogger()
	caller := &ServeHTTPCaller{log: log}

	// mockResponseWriter does NOT implement http.Flusher
	w := &mockResponseWriter{headers: make(http.Header)}

	assert.NotPanics(t, func() {
		caller.flush(w)
		caller.flush(w)
		caller.flush(w)
	})
}

func TestFlushGracefulDegradation(t *testing.T) {
	// Mirror the test from server/public/plugin/http_test.go
	// Ensure flush is gracefully handled when underlying writer doesn't support it
	type basicWriter struct {
		http.ResponseWriter
	}

	log, _ := mlog.NewLogger()
	caller := &ServeHTTPCaller{log: log}

	mockWriter := &basicWriter{
		ResponseWriter: &mockResponseWriter{headers: make(http.Header)},
	}

	// Verify it doesn't implement Flusher
	_, ok := any(mockWriter).(http.Flusher)
	require.False(t, ok, "basicWriter should not implement http.Flusher")

	// Test that flush doesn't panic
	assert.NotPanics(t, func() {
		caller.flush(mockWriter)
	})
}

func TestStreamResponseBody_WithFlush(t *testing.T) {
	// Test that streamResponseBody handles flush flags correctly
	log, _ := mlog.NewLogger()
	caller := &ServeHTTPCaller{log: log}

	// Create mock stream with responses that include flush flags
	stream := &mockServeHTTPStream{
		ctx: context.Background(),
		responses: []*pb.ServeHTTPResponse{
			{
				BodyChunk: []byte("chunk1"),
				Flush:     true,
			},
			{
				BodyChunk: []byte("chunk2"),
				Flush:     false,
			},
			{
				BodyChunk:    []byte("chunk3"),
				Flush:        true,
				BodyComplete: true,
			},
		},
	}

	w := &mockFlusherResponseWriter{
		mockResponseWriter: mockResponseWriter{headers: make(http.Header)},
	}

	err := caller.streamResponseBody(stream, w)
	require.NoError(t, err)

	// Should have called flush twice (chunk1 and chunk3)
	assert.Equal(t, 2, w.FlushCount())

	// All body chunks should be written
	assert.Equal(t, "chunk1chunk2chunk3", w.body.String())
}

// =============================================================================
// Early Response Tests (Phase 8.2)
// =============================================================================

// blockingReader is a reader that blocks until cancelled or notified
type blockingReader struct {
	data       []byte
	offset     int
	blockCh    chan struct{}
	notifiedCh chan struct{}
}

func (r *blockingReader) Read(p []byte) (int, error) {
	if r.offset >= len(r.data) {
		// Notify that we're about to block
		select {
		case r.notifiedCh <- struct{}{}:
		default:
		}

		// Block until closed
		<-r.blockCh
		return 0, context.Canceled
	}

	n := copy(p, r.data[r.offset:])
	r.offset += n
	return n, nil
}

func TestEarlyResponse_CancelsRequestSend(t *testing.T) {
	// Test that when plugin responds early, request sending stops

	// Create a reader that will block
	blockCh := make(chan struct{})
	notifiedCh := make(chan struct{}, 1)
	largeBody := strings.Repeat("x", 10000)
	reader := &blockingReader{
		data:       []byte(largeBody),
		blockCh:    blockCh,
		notifiedCh: notifiedCh,
	}

	httpReq, err := http.NewRequest("POST", "/test", reader)
	require.NoError(t, err)

	stream := &mockServeHTTPStream{
		ctx:      context.Background(),
		requests: make([]*pb.ServeHTTPRequest, 0),
	}

	// Create a cancellable context
	ctx, cancel := context.WithCancel(context.Background())

	log, _ := mlog.NewLogger()
	caller := &ServeHTTPCaller{chunkSize: 1000, log: log}

	// Start sending in a goroutine
	var sendErr error
	var wg sync.WaitGroup
	wg.Add(1)
	go func() {
		defer wg.Done()
		sendErr = caller.sendRequest(ctx, stream, nil, httpReq)
	}()

	// Wait for reader to block (indicating it has read some data)
	select {
	case <-notifiedCh:
		// Reader is now blocked
	case <-context.WithValue(context.Background(), "timeout", 1).Done():
		t.Fatal("reader didn't notify")
	}

	// Simulate early response by cancelling the context
	cancel()

	// Unblock the reader
	close(blockCh)

	// Wait for send to complete
	wg.Wait()

	// Send should have returned with context cancelled error
	assert.Error(t, sendErr)
	assert.True(t, sendErr == context.Canceled || strings.Contains(sendErr.Error(), "context canceled"))

	// Some requests should have been sent before cancellation
	assert.Greater(t, len(stream.requests), 0, "should have sent at least one request")

	// First request should have init
	assert.NotNil(t, stream.requests[0].Init)
}
