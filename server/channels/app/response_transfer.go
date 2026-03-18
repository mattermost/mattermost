// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"
)

type PluginResponseWriter struct {
	pipeWriter    *io.PipeWriter
	headers       http.Header
	statusCode    int
	ResponseReady chan struct{}
}

func NewPluginResponseWriter(pw *io.PipeWriter) *PluginResponseWriter {
	return &PluginResponseWriter{
		pipeWriter:    pw,
		headers:       make(http.Header),
		ResponseReady: make(chan struct{}),
	}
}

func (rt *PluginResponseWriter) Header() http.Header {
	if rt.headers == nil {
		rt.headers = make(http.Header)
	}
	return rt.headers
}

// markResponseReady safely closes the ResponseReady channel if not already closed
func (rt *PluginResponseWriter) markResponseReady() {
	select {
	case <-rt.ResponseReady:
	default:
		close(rt.ResponseReady)
	}
}

func (rt *PluginResponseWriter) Write(data []byte) (int, error) {
	// Signal that response are ready on first write if not already done
	rt.markResponseReady()
	return rt.pipeWriter.Write(data)
}

func (rt *PluginResponseWriter) WriteHeader(statusCode int) {
	if rt.statusCode == 0 {
		rt.statusCode = statusCode
		rt.markResponseReady()
	}
}

func (rt *PluginResponseWriter) Flush() {
	// Signal response are ready if not already done
	rt.markResponseReady()
	// Pipe doesn't need explicit flushing, but we implement the interface
}

// From net/http/httptest/recorder.go
func parseContentLength(cl string) int64 {
	cl = strings.TrimSpace(cl)
	if cl == "" {
		return -1
	}
	n, err := strconv.ParseInt(cl, 10, 64)
	if err != nil {
		return -1
	}
	return n
}

func (rt *PluginResponseWriter) GenerateResponse(pr *io.PipeReader) *http.Response {
	res := &http.Response{
		Proto:      "HTTP/1.1",
		ProtoMajor: 1,
		ProtoMinor: 1,
		StatusCode: rt.statusCode,
		Header:     rt.headers.Clone(),
		Body:       pr,
	}

	if res.StatusCode == 0 {
		res.StatusCode = http.StatusOK
	}

	res.Status = fmt.Sprintf("%03d %s", res.StatusCode, http.StatusText(res.StatusCode))

	res.ContentLength = parseContentLength(rt.headers.Get("Content-Length"))

	return res
}

func (rt *PluginResponseWriter) CloseWithError(err error) error {
	// Ensure ResponseReady is closed to prevent deadlock
	rt.markResponseReady()
	return rt.pipeWriter.CloseWithError(err)
}

func (rt *PluginResponseWriter) Close() error {
	// Ensure ResponseReady is closed to prevent deadlock
	rt.markResponseReady()
	return rt.pipeWriter.Close()
}
