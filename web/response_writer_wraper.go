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

func (w *ResponseWriterWrapper) StatusCode() int {
	return w.statusCode
}

func (w *ResponseWriterWrapper) WriteHeader(statusCode int) {
	w.statusCode = statusCode
	w.statusCodeWritten = true
	w.ResponseWriter.WriteHeader(statusCode)
}

func (w *ResponseWriterWrapper) Write(data []byte) (int, error) {
	if !w.statusCodeWritten {
		w.statusCode = http.StatusOK
	}
	return w.ResponseWriter.Write(data)
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
