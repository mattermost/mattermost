// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package plugin

import (
	"net"
	"net/http"
	"net/http/httptest"
	"net/rpc"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// TestFlushGracefulDegradation verifies that the Flush RPC handler gracefully handles
// underlying writers that don't support http.Flusher interface
func TestFlushGracefulDegradation(t *testing.T) {
	// Create a mock writer that does NOT implement http.Flusher
	type basicWriter struct {
		http.ResponseWriter
	}
	mockWriter := &basicWriter{
		ResponseWriter: httptest.NewRecorder(),
	}

	// Verify it doesn't implement Flusher
	_, ok := any(mockWriter).(http.Flusher)
	require.False(t, ok, "basicWriter should not implement http.Flusher")

	// Create server with non-Flusher writer
	server := &httpResponseWriterRPCServer{
		w: mockWriter,
	}

	// Test that Flush doesn't panic even when underlying writer doesn't support it
	assert.NotPanics(t, func() {
		err := server.Flush(struct{}{}, &struct{}{})
		assert.NoError(t, err)
	})
}

type nilHeaderResponseWriter struct{}

func (w *nilHeaderResponseWriter) Header() http.Header {
	return nil
}

func (w *nilHeaderResponseWriter) Write(p []byte) (int, error) {
	return len(p), nil
}

func (w *nilHeaderResponseWriter) WriteHeader(statusCode int) {}

func TestHTTPResponseWriterRPCClientClosedStream(t *testing.T) {
	t.Run("Header never returns nil and subsequent calls do not panic on closed stream", func(t *testing.T) {
		serverConn, clientConn := net.Pipe()
		require.NoError(t, serverConn.Close())

		w := connectHTTPResponseWriter(clientConn)
		defer w.Close()

		var h http.Header
		require.NotPanics(t, func() {
			h = w.Header()
			h.Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusInternalServerError)
			w.Flush()
		})
		require.NotNil(t, h)
		require.Equal(t, "application/json", w.Header().Get("Content-Type"))

		n, err := w.Write([]byte("body"))
		require.Zero(t, n)
		require.Error(t, err)
	})

	t.Run("Write, WriteHeader, and Flush do not panic on closed stream without prior Header call", func(t *testing.T) {
		serverConn, clientConn := net.Pipe()
		require.NoError(t, serverConn.Close())

		w := connectHTTPResponseWriter(clientConn)
		defer w.Close()

		require.NotPanics(t, func() {
			w.WriteHeader(http.StatusInternalServerError)
			w.Flush()
		})

		n, err := w.Write([]byte("body"))
		require.Zero(t, n)
		require.Error(t, err)
	})

	t.Run("Header returns non-nil map when remote returns nil header", func(t *testing.T) {
		serverConn, clientConn := net.Pipe()
		rpcServer := rpc.NewServer()
		require.NoError(t, rpcServer.RegisterName("Plugin", &httpResponseWriterRPCServer{
			w: &nilHeaderResponseWriter{},
		}))
		go rpcServer.ServeConn(serverConn)

		w := connectHTTPResponseWriter(clientConn)
		defer w.Close()

		var h http.Header
		require.NotPanics(t, func() {
			h = w.Header()
			h.Set("X-Test", "1")
			w.WriteHeader(http.StatusOK)
			_, err := w.Write([]byte("ok"))
			assert.NoError(t, err)
			w.Flush()
		})
		require.NotNil(t, h)
		require.Equal(t, "1", w.Header().Get("X-Test"))
	})
}
