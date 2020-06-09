// Copyright 2009 The Go Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

// Package http provides helpers for HTTP servers.
package http

import (
	"bytes"
	"errors"
	"io"
	"net/http"
	"sync"
	"time"
)

// TimeoutHandler returns a Handler that runs h with the given time limit.
//
// The new Handler calls h.ServeHTTP to handle each request, but if a
// call runs for longer than its time limit, the handler responds with
// a 504 Gateway Timeout error and the given message in its body.
// (If msg is empty, a suitable default message will be sent.)
// After such a timeout, writes by h to its ResponseWriter will return
// ErrHandlerTimeout.
//
// TimeoutHandler buffers all Handler writes to memory and does not
// support the Hijacker or Flusher interfaces.
func TimeoutHandler(h http.Handler, dt time.Duration, msg string) http.Handler {
	return &timeoutHandler{
		handler: h,
		body:    msg,
		dt:      dt,
	}
}

// ErrHandlerTimeout is returned on ResponseWriter Write calls
// in handlers which have timed out.
var ErrHandlerTimeout = errors.New("http: Handler timeout")

type timeoutHandler struct {
	handler http.Handler
	body    string
	dt      time.Duration

	// When set, no timer will be created and this channel will
	// be used instead.
	testTimeout <-chan time.Time
}

func (h *timeoutHandler) errorBody() string {
	if h.body != "" {
		return h.body
	}
	return "<html><head><title>Timeout</title></head><body><h1>Timeout</h1></body></html>"
}

func (h *timeoutHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	var t *time.Timer
	timeout := h.testTimeout
	if timeout == nil {
		t = time.NewTimer(h.dt)
		timeout = t.C
	}
	done := make(chan struct{})
	tw := &timeoutWriter{
		w: w,
		h: make(http.Header),
	}
	go func() {
		h.handler.ServeHTTP(tw, r)
		close(done)
	}()
	select {
	case <-done:
		tw.mu.Lock()
		defer tw.mu.Unlock()
		dst := w.Header()
		for k, vv := range tw.h {
			dst[k] = vv
		}
		if !tw.wroteHeader {
			tw.code = http.StatusOK
		}
		w.WriteHeader(tw.code)
		w.Write(tw.wbuf.Bytes())
		if t != nil {
			t.Stop()
		}
	case <-timeout:
		tw.mu.Lock()
		defer tw.mu.Unlock()
		w.WriteHeader(http.StatusGatewayTimeout)
		io.WriteString(w, h.errorBody())
		tw.timedOut = true
		return
	}
}

type timeoutWriter struct {
	w    http.ResponseWriter
	h    http.Header
	wbuf bytes.Buffer

	mu          sync.Mutex
	timedOut    bool
	wroteHeader bool
	code        int
}

func (tw *timeoutWriter) Header() http.Header { return tw.h }

func (tw *timeoutWriter) Write(p []byte) (int, error) {
	tw.mu.Lock()
	defer tw.mu.Unlock()
	if tw.timedOut {
		return 0, ErrHandlerTimeout
	}
	if !tw.wroteHeader {
		tw.writeHeader(http.StatusOK)
	}
	return tw.wbuf.Write(p)
}

func (tw *timeoutWriter) WriteHeader(code int) {
	tw.mu.Lock()
	defer tw.mu.Unlock()
	if tw.timedOut || tw.wroteHeader {
		return
	}
	tw.writeHeader(code)
}

func (tw *timeoutWriter) writeHeader(code int) {
	tw.wroteHeader = true
	tw.code = code
}
