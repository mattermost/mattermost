// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package web

import (
	"bufio"
	"net"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

type TestHandler struct {
	TestFunc func(w http.ResponseWriter, r *http.Request)
}

func (h *TestHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	h.TestFunc(w, r)
}

type responseRecorderHijack struct {
	httptest.ResponseRecorder
}

func (r *responseRecorderHijack) Hijack() (net.Conn, *bufio.ReadWriter, error) {
	r.WriteHeader(http.StatusOK)
	return nil, nil, nil
}

func newResponseWithHijack(original *httptest.ResponseRecorder) *responseRecorderHijack {
	return &responseRecorderHijack{*original}
}

func TestStatusCodeIsAccessible(t *testing.T) {
	resp := newWrappedWriter(httptest.NewRecorder())
	req := httptest.NewRequest("GET", "/api/v4/test", nil)
	handler := TestHandler{func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusBadRequest)
	}}
	handler.ServeHTTP(resp, req)
	assert.Equal(t, http.StatusBadRequest, resp.StatusCode())
}

func TestStatusCodeShouldBe200IfNotHeaderWritten(t *testing.T) {
	resp := newWrappedWriter(httptest.NewRecorder())
	req := httptest.NewRequest("GET", "/api/v4/test", nil)
	handler := TestHandler{func(w http.ResponseWriter, r *http.Request) {
		n, err := w.Write([]byte{})
		require.NoError(t, err, "Failed to write response")
		require.Equal(t, 0, n, "Expected to write 0 bytes")
	}}
	handler.ServeHTTP(resp, req)
	assert.Equal(t, http.StatusOK, resp.StatusCode())
}

func TestForUnsupportedHijack(t *testing.T) {
	resp := newWrappedWriter(httptest.NewRecorder())
	req := httptest.NewRequest("GET", "/api/v4/test", nil)
	handler := TestHandler{func(w http.ResponseWriter, r *http.Request) {
		conn, rw, err := w.(*responseWriterWrapper).Hijack()
		assert.Error(t, err)
		assert.Equal(t, "Hijacker interface not supported by the wrapped ResponseWriter", err.Error())
		assert.Nil(t, conn, "Expected nil connection")
		assert.Nil(t, rw, "Expected nil buffer")
	}}
	handler.ServeHTTP(resp, req)
}

func TestForSupportedHijack(t *testing.T) {
	resp := newWrappedWriter(newResponseWithHijack(httptest.NewRecorder()))
	req := httptest.NewRequest("GET", "/api/v4/test", nil)
	handler := TestHandler{func(w http.ResponseWriter, r *http.Request) {
		conn, rw, err := w.(*responseWriterWrapper).Hijack()
		require.NoError(t, err, "Hijack should succeed with supporting ResponseWriter")
		assert.Nil(t, conn, "Expected nil connection from test implementation")
		assert.Nil(t, rw, "Expected nil buffer from test implementation")
	}}
	handler.ServeHTTP(resp, req)
}

func TestForSupportedFlush(t *testing.T) {
	resp := newWrappedWriter(httptest.NewRecorder())
	req := httptest.NewRequest("GET", "/api/v4/test", nil)
	handler := TestHandler{func(w http.ResponseWriter, r *http.Request) {
		n, err := w.Write([]byte{})
		require.NoError(t, err, "Failed to write response")
		require.Equal(t, 0, n, "Expected to write 0 bytes")
		w.(*responseWriterWrapper).Flush()
	}}
	handler.ServeHTTP(resp, req)
	assert.Equal(t, http.StatusOK, resp.StatusCode())
}
