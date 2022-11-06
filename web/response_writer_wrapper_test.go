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
	req := httptest.NewRequest(http.MethodGet, "/api/v4/test", http.NoBody)
	handler := TestHandler{func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusBadRequest)
	}}
	handler.ServeHTTP(resp, req)
	assert.Equal(t, http.StatusBadRequest, resp.StatusCode())
}

func TestStatusCodeShouldBe200IfNotHeaderWritten(t *testing.T) {
	resp := newWrappedWriter(httptest.NewRecorder())
	req := httptest.NewRequest(http.MethodGet, "/api/v4/test", http.NoBody)
	handler := TestHandler{func(w http.ResponseWriter, r *http.Request) {
		w.Write([]byte{})
	}}
	handler.ServeHTTP(resp, req)
	assert.Equal(t, http.StatusOK, resp.StatusCode())
}

func TestForUnsupportedHijack(t *testing.T) {
	resp := newWrappedWriter(httptest.NewRecorder())
	req := httptest.NewRequest(http.MethodGet, "/api/v4/test", http.NoBody)
	handler := TestHandler{func(w http.ResponseWriter, r *http.Request) {
		_, _, err := w.(*responseWriterWrapper).Hijack()
		assert.Error(t, err)
		assert.Equal(t, "Hijacker interface not supported by the wrapped ResponseWriter", err.Error())
	}}
	handler.ServeHTTP(resp, req)
}

func TestForSupportedHijack(t *testing.T) {
	resp := newWrappedWriter(newResponseWithHijack(httptest.NewRecorder()))
	req := httptest.NewRequest(http.MethodGet, "/api/v4/test", http.NoBody)
	handler := TestHandler{func(w http.ResponseWriter, r *http.Request) {
		_, _, err := w.(*responseWriterWrapper).Hijack()
		assert.NoError(t, err)
	}}
	handler.ServeHTTP(resp, req)
}

func TestForSupportedFlush(t *testing.T) {
	resp := newWrappedWriter(httptest.NewRecorder())
	req := httptest.NewRequest(http.MethodGet, "/api/v4/test", http.NoBody)
	handler := TestHandler{func(w http.ResponseWriter, r *http.Request) {
		w.Write([]byte{})
		w.(*responseWriterWrapper).Flush()
	}}
	handler.ServeHTTP(resp, req)
	assert.Equal(t, http.StatusOK, resp.StatusCode())
}
