package gziphandler

import (
	"compress/gzip"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"sync"
)

const (
	vary            = "Vary"
	acceptEncoding  = "Accept-Encoding"
	contentEncoding = "Content-Encoding"
)

type codings map[string]float64

// The default qvalue to assign to an encoding if no explicit qvalue is set.
// This is actually kind of ambiguous in RFC 2616, so hopefully it's correct.
// The examples seem to indicate that it is.
const DEFAULT_QVALUE = 1.0

var gzipWriterPool = sync.Pool{
	New: func() interface{} { return gzip.NewWriter(nil) },
}

// GzipResponseWriter provides an http.ResponseWriter interface, which gzips
// bytes before writing them to the underlying response. This doesn't set the
// Content-Encoding header, nor close the writers, so don't forget to do that.
type GzipResponseWriter struct {
	gw *gzip.Writer
	http.ResponseWriter
}

// Write appends data to the gzip writer.
func (w GzipResponseWriter) Write(b []byte) (int, error) {
	if _, ok := w.Header()["Content-Type"]; !ok {
		// If content type is not set, infer it from the uncompressed body.
		w.Header().Set("Content-Type", http.DetectContentType(b))
	}
	return w.gw.Write(b)
}

// Flush flushes the underlying *gzip.Writer and then the underlying
// http.ResponseWriter if it is an http.Flusher. This makes GzipResponseWriter
// an http.Flusher.
func (w GzipResponseWriter) Flush() {
	w.gw.Flush()
	if fw, ok := w.ResponseWriter.(http.Flusher); ok {
		fw.Flush()
	}
}

// GzipHandler wraps an HTTP handler, to transparently gzip the response body if
// the client supports it (via the Accept-Encoding header).
func GzipHandler(h http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Add(vary, acceptEncoding)

		if acceptsGzip(r) {
			// Bytes written during ServeHTTP are redirected to this gzip writer
			// before being written to the underlying response.
			gzw := gzipWriterPool.Get().(*gzip.Writer)
			defer gzipWriterPool.Put(gzw)
			gzw.Reset(w)
			defer gzw.Close()

			w.Header().Set(contentEncoding, "gzip")
			h.ServeHTTP(GzipResponseWriter{gzw, w}, r)
		} else {
			h.ServeHTTP(w, r)
		}
	})
}

// acceptsGzip returns true if the given HTTP request indicates that it will
// accept a gzippped response.
func acceptsGzip(r *http.Request) bool {
	acceptedEncodings, _ := parseEncodings(r.Header.Get(acceptEncoding))
	return acceptedEncodings["gzip"] > 0.0
}

// parseEncodings attempts to parse a list of codings, per RFC 2616, as might
// appear in an Accept-Encoding header. It returns a map of content-codings to
// quality values, and an error containing the errors encounted. It's probably
// safe to ignore those, because silently ignoring errors is how the internet
// works.
//
// See: http://tools.ietf.org/html/rfc2616#section-14.3
func parseEncodings(s string) (codings, error) {
	c := make(codings)
	e := make([]string, 0)

	for _, ss := range strings.Split(s, ",") {
		coding, qvalue, err := parseCoding(ss)

		if err != nil {
			e = append(e, err.Error())

		} else {
			c[coding] = qvalue
		}
	}

	// TODO (adammck): Use a proper multi-error struct, so the individual errors
	//                 can be extracted if anyone cares.
	if len(e) > 0 {
		return c, fmt.Errorf("errors while parsing encodings: %s", strings.Join(e, ", "))
	}

	return c, nil
}

// parseCoding parses a single conding (content-coding with an optional qvalue),
// as might appear in an Accept-Encoding header. It attempts to forgive minor
// formatting errors.
func parseCoding(s string) (coding string, qvalue float64, err error) {
	for n, part := range strings.Split(s, ";") {
		part = strings.TrimSpace(part)
		qvalue = DEFAULT_QVALUE

		if n == 0 {
			coding = strings.ToLower(part)

		} else if strings.HasPrefix(part, "q=") {
			qvalue, err = strconv.ParseFloat(strings.TrimPrefix(part, "q="), 64)

			if qvalue < 0.0 {
				qvalue = 0.0

			} else if qvalue > 1.0 {
				qvalue = 1.0
			}
		}
	}

	if coding == "" {
		err = fmt.Errorf("empty content-coding")
	}

	return
}
