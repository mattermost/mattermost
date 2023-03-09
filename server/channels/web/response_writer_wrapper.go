// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package web

import (
	"bufio"
	"errors"
	"net"
	"net/http"
)

type responseWriterWrapper struct {
	http.ResponseWriter
	statusCode        int
	statusCodeWritten bool
	hijacker          http.Hijacker
	flusher           http.Flusher
}

func newWrappedWriter(original http.ResponseWriter) *responseWriterWrapper {
	hijacker, _ := original.(http.Hijacker)
	flusher, _ := original.(http.Flusher)
	return &responseWriterWrapper{
		ResponseWriter:    original,
		statusCodeWritten: false,
		hijacker:          hijacker,
		flusher:           flusher,
	}
}

func (rw *responseWriterWrapper) StatusCode() int {
	return rw.statusCode
}

func (rw *responseWriterWrapper) WriteHeader(statusCode int) {
	rw.statusCode = statusCode
	rw.statusCodeWritten = true
	rw.ResponseWriter.WriteHeader(statusCode)
}

func (rw *responseWriterWrapper) Write(data []byte) (int, error) {
	if !rw.statusCodeWritten {
		rw.statusCode = http.StatusOK
	}
	return rw.ResponseWriter.Write(data)
}

// Using as embedded makes the ResponseWrite be stored as interface and that way
// it loses the access to the implementation for Hijack or Flush
func (rw *responseWriterWrapper) Hijack() (net.Conn, *bufio.ReadWriter, error) {
	if rw.hijacker == nil {
		return nil, nil, errors.New("Hijacker interface not supported by the wrapped ResponseWriter")
	}
	return rw.hijacker.Hijack()
}

func (rw *responseWriterWrapper) Flush() {
	if rw.flusher != nil {
		rw.flusher.Flush()
	}
}
