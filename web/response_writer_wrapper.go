// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package web

import (
	"bufio"
	"errors"
	"net"
	"net/http"
)

type ResponseWriterWrapper struct {
	http.ResponseWriter
	statusCode        int
	statusCodeWritten bool
	hijacker          http.Hijacker
	flusher           http.Flusher
}

func BuildResponseWriter(original http.ResponseWriter) *ResponseWriterWrapper {
	hijacker, _ := original.(http.Hijacker)
	flusher, _ := original.(http.Flusher)
	return &ResponseWriterWrapper{
		ResponseWriter:    original,
		statusCodeWritten: false,
		hijacker:          hijacker,
		flusher:           flusher,
	}
}

func (rw *ResponseWriterWrapper) StatusCode() int {
	return rw.statusCode
}

func (rw *ResponseWriterWrapper) WriteHeader(statusCode int) {
	rw.statusCode = statusCode
	rw.statusCodeWritten = true
	rw.ResponseWriter.WriteHeader(statusCode)
}

func (rw *ResponseWriterWrapper) Write(data []byte) (int, error) {
	if !rw.statusCodeWritten {
		rw.statusCode = http.StatusOK
	}
	return rw.ResponseWriter.Write(data)
}

// Using as embedded makes the ResponseWrite be stored as interface and that way
// it loses the access to the implementation for Hijack or Flush
func (rw *ResponseWriterWrapper) Hijack() (net.Conn, *bufio.ReadWriter, error) {
	if rw.hijacker == nil {
		return nil, nil, errors.New("Hijacker interface not supported by the wrapped ResponseWriter")
	}
	return rw.hijacker.Hijack()
}

func (rw *ResponseWriterWrapper) Flush() {
	if rw.flusher != nil {
		rw.flusher.Flush()
	}
}
