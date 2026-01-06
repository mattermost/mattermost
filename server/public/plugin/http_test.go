// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package plugin

import (
	"net/http"
	"net/http/httptest"
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
